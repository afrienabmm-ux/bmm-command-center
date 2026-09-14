import JSZip from "jszip";
import { supabaseAdmin } from "./supabase-server";
import { sendEmail } from "./email";

// No user session here — this runs from a scheduled cron hit (see
// app/api/cron/monthly-photo-report/route.ts), which authenticates with
// CRON_SECRET instead of a signed-in account. Every query below goes
// straight through supabaseAdmin, the same way the partner-webhook API
// routes do.

const JOBSHEET_PHOTO_BUCKET = "jobsheet-photos";
const GENBLU_SCREENSHOT_BUCKET = "genblu-screenshots";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Windows/macOS/zip-unsafe characters replaced with "-" so every name is
// safe to write inside the zip regardless of what's actually in the DB
// (e.g. a customer name typed with a "/" in it).
function sanitizeFilename(raw: string): string {
  const cleaned = raw.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return cleaned || "unnamed";
}

function extensionOf(path: string): string {
  const ext = path.split(".").pop();
  return ext && ext.length <= 5 ? ext.toLowerCase() : "jpg";
}

// Same base name reused twice (two jobsheets scanned under the same
// jobsheet no, or two GenBlu screenshots for the same customer this month)
// gets " (2)", " (3)"... appended instead of one silently overwriting the
// other inside the zip.
function uniqueName(base: string, ext: string, used: Map<string, number>): string {
  const key = base.toLowerCase();
  const seen = used.get(key) ?? 0;
  used.set(key, seen + 1);
  return seen === 0 ? `${base}.${ext}` : `${base} (${seen + 1}).${ext}`;
}

// Calendar month right before `reference` (defaults to now) — the cron
// fires at the start of a month and should archive the month that just
// finished, not the one that's only just begun.
function previousMonth(reference = new Date()): { year: number; month: number } {
  const y = reference.getUTCFullYear();
  const m = reference.getUTCMonth(); // 0-based; previous month index is m - 1
  return m === 0 ? { year: y - 1, month: 12 } : { year: y, month: m };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type PendingFile = {
  bucket: string;
  path: string;
  zipFolder: string;
  baseName: string;
  // Which row/column to clear once the file is safely emailed and removed
  // from storage — the record itself is kept, only the now-dangling photo
  // reference is cleared so the app stops trying to show a deleted image.
  table: string;
  rowId: string;
  column: string;
};

export type MonthlyPhotoReportResult =
  | { skipped: true; reason: string }
  | {
      skipped: false;
      year: number;
      month: number;
      jobsheetPhotoCount: number;
      genbluScreenshotCount: number;
      failedDownloads: number;
      emailed: boolean;
      emailError?: string;
      deletedFiles: number;
    };

export async function runMonthlyPhotoReport(
  target?: { year: number; month: number },
  // Builds and emails the zip exactly as normal but skips deleting anything
  // afterward — lets a real month be checked (naming, counts, the email
  // itself) before ever letting the irreversible cleanup run for real.
  dryRun = false
): Promise<MonthlyPhotoReportResult> {
  const { year, month } = target ?? previousMonth();
  const from = `${year}-${pad(month)}-01T00:00:00`;
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const to = `${nextMonth.year}-${pad(nextMonth.month)}-01T00:00:00`;
  const label = `${MONTH_NAMES[month - 1]} ${year}`;

  const [{ data: jobs, error: jobsErr }, { data: regs, error: regsErr }, { data: txns, error: txnsErr }] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("id, jobsheet_no, job_no, jobsheet_photo_path, created_at")
      .eq("job_type", "Walk-in")
      .not("jobsheet_photo_path", "is", null)
      .gte("created_at", from)
      .lt("created_at", to),
    supabaseAdmin
      .from("cc_genblu_registrations")
      .select("id, customer_name, screenshot_path, created_at")
      .not("screenshot_path", "is", null)
      .gte("created_at", from)
      .lt("created_at", to),
    supabaseAdmin
      .from("cc_genblu_transactions")
      .select("id, customer_name, screenshot_path, created_at")
      .not("screenshot_path", "is", null)
      .gte("created_at", from)
      .lt("created_at", to),
  ]);
  if (jobsErr) throw new Error(jobsErr.message);
  if (regsErr) throw new Error(regsErr.message);
  if (txnsErr) throw new Error(txnsErr.message);

  const pending: PendingFile[] = [
    ...(jobs ?? []).map((j) => ({
      bucket: JOBSHEET_PHOTO_BUCKET,
      path: j.jobsheet_photo_path as string,
      zipFolder: "Jobsheet Photos",
      baseName: sanitizeFilename(j.jobsheet_no?.trim() || j.job_no),
      table: "cc_repair_jobs",
      rowId: j.id as string,
      column: "jobsheet_photo_path",
    })),
    ...(regs ?? []).map((r) => ({
      bucket: GENBLU_SCREENSHOT_BUCKET,
      path: r.screenshot_path as string,
      zipFolder: "GenBlu Screenshots",
      baseName: sanitizeFilename(r.customer_name),
      table: "cc_genblu_registrations",
      rowId: r.id as string,
      column: "screenshot_path",
    })),
    ...(txns ?? []).map((t) => ({
      bucket: GENBLU_SCREENSHOT_BUCKET,
      path: t.screenshot_path as string,
      zipFolder: "GenBlu Screenshots",
      baseName: sanitizeFilename(t.customer_name),
      table: "cc_genblu_transactions",
      rowId: t.id as string,
      column: "screenshot_path",
    })),
  ];

  if (pending.length === 0) {
    await sendEmail({
      to: recipientEmail(),
      subject: `BMM Photo Archive — ${label}`,
      html: `<p>No jobsheet photos or GenBlu screenshots were uploaded in ${label}, so there's nothing to archive this month.</p>`,
    });
    return { skipped: true, reason: `No photos found for ${label}.` };
  }

  // Downloaded in parallel batches rather than one at a time — a busy
  // month can easily be a few hundred files, and awaiting each of those
  // network round-trips sequentially was slow enough (~60s+ for a single
  // month in testing) to risk the cron route's own time limit killing the
  // run partway through.
  const DOWNLOAD_CONCURRENCY = 12;
  const downloaded: { file: PendingFile; buffer: Buffer }[] = [];
  let failedDownloads = 0;
  for (let i = 0; i < pending.length; i += DOWNLOAD_CONCURRENCY) {
    const batch = pending.slice(i, i + DOWNLOAD_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (file) => {
        const { data, error } = await supabaseAdmin.storage.from(file.bucket).download(file.path);
        if (error || !data) return null;
        return { file, buffer: Buffer.from(await data.arrayBuffer()) };
      })
    );
    for (const r of results) {
      if (r) downloaded.push(r);
      else failedDownloads++;
    }
  }

  const zip = new JSZip();
  const usedNames = new Map<string, Map<string, number>>();
  const successfullyZipped: PendingFile[] = [];
  for (const { file, buffer } of downloaded) {
    const ext = extensionOf(file.path);
    const folderNames = usedNames.get(file.zipFolder) ?? new Map<string, number>();
    usedNames.set(file.zipFolder, folderNames);
    const filename = uniqueName(file.baseName, ext, folderNames);
    zip.folder(file.zipFolder)?.file(filename, buffer);
    successfullyZipped.push(file);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const jobsheetPhotoCount = successfullyZipped.filter((f) => f.table === "cc_repair_jobs").length;
  const genbluScreenshotCount = successfullyZipped.length - jobsheetPhotoCount;

  const sizeMb = (zipBuffer.length / (1024 * 1024)).toFixed(1);
  const emailResult = await sendEmail({
    to: recipientEmail(),
    subject: `BMM Photo Archive — ${label}`,
    html: `
      <p>Attached: every jobsheet photo and GenBlu screenshot uploaded in ${label}.</p>
      <ul>
        <li>${jobsheetPhotoCount} jobsheet photo${jobsheetPhotoCount === 1 ? "" : "s"} (named by jobsheet no.)</li>
        <li>${genbluScreenshotCount} GenBlu screenshot${genbluScreenshotCount === 1 ? "" : "s"} (named by customer name)</li>
      </ul>
      ${failedDownloads > 0 ? `<p>${failedDownloads} file(s) couldn't be read from storage and were skipped — they were left untouched.</p>` : ""}
      <p>Zip size: ${sizeMb} MB.</p>
      ${dryRun ? `<p><strong>This was a test run — the original files were left in place, nothing was deleted.</strong></p>` : ""}
    `,
    attachments: [{ filename: `BMM Photo Archive - ${label}.zip`, content: zipBuffer, cid: "monthly-photo-archive" }],
  });

  if ("error" in emailResult) {
    // Nothing gets deleted unless the email genuinely went out — a failed
    // send must never be the reason photos disappear with no backup.
    return {
      skipped: false,
      year,
      month,
      jobsheetPhotoCount,
      genbluScreenshotCount,
      failedDownloads,
      emailed: false,
      emailError: emailResult.error,
      deletedFiles: 0,
    };
  }

  if (!dryRun) {
    const byBucket = new Map<string, string[]>();
    for (const file of successfullyZipped) {
      byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.path]);
    }
    for (const [bucket, paths] of byBucket) {
      await supabaseAdmin.storage.from(bucket).remove(paths);
    }
    // Clear the now-deleted photo's path off its row so the app doesn't try
    // to load a signed URL for a file that no longer exists — everything
    // else about the jobsheet/registration/transaction stays untouched.
    await Promise.all(
      successfullyZipped.map((file) => supabaseAdmin.from(file.table).update({ [file.column]: null }).eq("id", file.rowId))
    );
  }

  return {
    skipped: false,
    year,
    month,
    jobsheetPhotoCount,
    genbluScreenshotCount,
    failedDownloads,
    emailed: true,
    deletedFiles: dryRun ? 0 : successfullyZipped.length,
  };
}

function recipientEmail(): string {
  return process.env.MONTHLY_REPORT_EMAIL || "afrienabmm@gmail.com";
}
