// The daily After-Sales "needs attention" message for Telegram. Read-only:
// it looks and reports, never changes a record. One message, up to four
// sections, and each section only appears when there is something to act on.
import { supabaseAdmin } from "./supabase-server";
import { BRANCHES } from "./branch";
import { classifyYamahaModel } from "./yamaha-model";
import { getGenbluPlatePoints, getGenbluTxLite, jobGenbluPoints } from "./genblu-plates";
import { checkCustomerCode } from "./customer-code";
import { todayInMalaysia } from "./malaysia-time";

const MAX_PER_BRANCH = 8;
const MAX_CHARS = 3900;

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}
const branchName = (v: string) => BRANCHES.find((b) => b.value === v)?.label ?? v;

type Job = {
  branch: string;
  job_no: string;
  jobsheet_no: string | null;
  customer_name: string | null;
  plate_no: string | null;
  model: string | null;
  revenue_amount: number | string;
  started_date: string | null;
  completed_date: string | null;
  customer_code: string | null;
  job_type: string | null;
  signature_status: string | null;
  signature_issue_resolved: boolean | null;
  created_at: string;
};

// Whatever was typed in the IC box may be a real IC or a phone number, so only
// the length and last 3 characters go into a group chat.
function masked(v: string | null): string {
  const t = (v ?? "").trim();
  if (!t) return "blank";
  return t.length <= 3 ? "***" : `${"*".repeat(Math.min(t.length - 3, 9))}${t.slice(-3)} (${t.replace(/[\s-]/g, "").length} chars)`;
}

function capped(lines: string[]): string[] {
  const out = lines.slice(0, MAX_PER_BRANCH);
  if (lines.length > out.length) out.push(`   ...and ${lines.length - out.length} more`);
  return out;
}

export async function buildAfterSalesAlerts(dateOverride?: string): Promise<{ sections: number; text: string | null }> {
  const today = dateOverride ?? todayInMalaysia();
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 1 = Monday
  const sinceNew = addDays(today, dow === 1 ? -2 : -1); // Monday also covers Saturday + Sunday
  const monthStart = `${today.slice(0, 7)}-01`;
  const chaseFrom = addDays(today, -4);
  const chaseTo = addDays(today, -2);

  const [jobsRes, plates, txs, txRes] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("branch, job_no, jobsheet_no, customer_name, plate_no, model, revenue_amount, started_date, completed_date, customer_code, job_type, signature_status, signature_issue_resolved, created_at")
      .gte("started_date", monthStart)
      .limit(5000),
    getGenbluPlatePoints(),
    getGenbluTxLite(),
    supabaseAdmin
      .from("cc_genblu_transactions")
      .select("branch, customer_name, membership_number, points, transaction_date, transaction_time, created_at")
      .gte("transaction_date", monthStart)
      .limit(5000),
  ]);
  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (txRes.error) throw new Error(txRes.error.message);
  const jobs = (jobsRes.data ?? []) as Job[];
  const txRows = txRes.data ?? [];

  const sections: string[] = [];

  // 1) Yamaha jobs done 2-4 days ago that still have no GenBlu (yesterday's are in the morning summary).
  {
    const lines: string[] = [];
    for (const { value, label } of BRANCHES) {
      const miss = jobs.filter(
        (j) =>
          j.branch === value &&
          j.completed_date &&
          j.completed_date >= chaseFrom &&
          j.completed_date <= chaseTo &&
          classifyYamahaModel(j.model ?? "") === "yamaha" &&
          jobGenbluPoints(plates, txs, { customerName: j.customer_name ?? "", plateNo: j.plate_no ?? "", cost: Number(j.revenue_amount), date: j.completed_date }) === null,
      );
      if (miss.length === 0) continue;
      lines.push(`${label} (${miss.length})`, ...capped(miss.map((j) => `   - ${j.customer_name ?? "?"} / ${j.plate_no ?? "-"}`)));
    }
    if (lines.length) sections.push(`🔵 Still no GenBlu (Yamaha jobs from ${chaseFrom} to ${chaseTo})\n${lines.join("\n")}`);
  }

  // 2) Customer Code (IC) errors: new since the last message, plus the month's backlog count.
  {
    const bad = jobs.filter((j) => j.job_type === "Walk-in" && checkCustomerCode(j.customer_code ?? "") !== "ok");
    if (bad.length) {
      const lines: string[] = [];
      for (const { value, label } of BRANCHES) {
        const mine = bad.filter((j) => j.branch === value);
        if (mine.length === 0) continue;
        const fresh = mine.filter((j) => (j.started_date ?? j.created_at.slice(0, 10)) >= sinceNew);
        lines.push(`${label}: ${fresh.length} new, ${mine.length} unfixed this month`);
        lines.push(...capped(fresh.map((j) => `   - ${j.jobsheet_no?.trim() || j.job_no} / ${j.customer_name ?? "?"}   : ${masked(j.customer_code)}`)));
      }
      sections.push(`🪪 Customer Code (IC) not valid\n${lines.join("\n")}\nFix them in Reports > Customer Code.`);
    }
  }

  // 3) Signature problems still open.
  {
    const lines: string[] = [];
    for (const { value, label } of BRANCHES) {
      const bad = jobs.filter(
        (j) => j.branch === value && (j.signature_status === "not_detected" || j.signature_status === "unchecked") && !j.signature_issue_resolved,
      );
      if (bad.length === 0) continue;
      lines.push(`${label} (${bad.length})`, ...capped(bad.map((j) => `   - ${j.jobsheet_no?.trim() || j.job_no} / ${j.customer_name ?? "?"}`)));
    }
    if (lines.length) sections.push(`✍️ Jobsheet signature not confirmed\n${lines.join("\n")}`);
  }

  // 4) GenBlu points uploaded twice (same member, time and points) in the last 2 days.
  {
    const groups = new Map<string, typeof txRows>();
    for (const t of txRows) {
      const k = [t.membership_number, t.transaction_date, t.transaction_time, t.points].join("|");
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    const cutoff = `${addDays(today, -2)}T00:00:00`;
    const dups = [...groups.values()].filter((g) => g.length > 1 && g.some((t) => String(t.created_at) >= cutoff));
    if (dups.length) {
      const lines = dups.map(
        (g) => `   - ${branchName(g[0].branch)}: ${g[0].customer_name} - ${g[0].points} pts on ${g[0].transaction_date} ${g[0].transaction_time ?? ""} (uploaded ${g.length}x)`,
      );
      sections.push(`♻️ GenBlu points uploaded twice (check the tracker isn't double-counting)\n${lines.join("\n")}`);
    }
  }

  if (sections.length === 0) return { sections: 0, text: null };
  let text = `🔔 After-Sales needs attention - ${today}\n\n${sections.join("\n\n")}`;
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + "\n...and more";
  return { sections: sections.length, text };
}
