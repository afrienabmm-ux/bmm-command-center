import { NextRequest, NextResponse } from "next/server";
import { runMonthlyPhotoReport } from "@/lib/monthly-report-actions";

export const runtime = "nodejs";
// A busy month can be a few hundred files — downloads now run in parallel
// batches (see runMonthlyPhotoReport), but this still leaves real headroom
// in case a future month is much larger than any tested so far.
export const maxDuration = 300;

// Vercel automatically sends "Authorization: Bearer <CRON_SECRET>" on every
// request it makes to a project's own cron endpoints, once CRON_SECRET is
// set as an env var — this is the standard way to stop anyone else from
// hitting the URL and triggering an (irreversible, storage-deleting) run
// on demand. Same header check also lets a real person re-run/test a past
// month by hand with a plain authenticated request.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional manual override for testing a specific past month, e.g.
  // /api/cron/monthly-photo-report?year=2026&month=8 — defaults to last
  // calendar month, which is what the real monthly cron run always uses.
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const target = yearParam && monthParam ? { year: Number(yearParam), month: Number(monthParam) } : undefined;
  // ?dryRun=1 — builds and emails the zip as normal but skips deleting
  // anything, so a real month can be checked before the irreversible
  // cleanup is ever allowed to run.
  const dryRun = searchParams.get("dryRun") === "1";

  try {
    const result = await runMonthlyPhotoReport(target, dryRun);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
