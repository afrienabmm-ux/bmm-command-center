"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";

// Shape is the Sales Dashboard's own to define (see
// app/api/genblu-report-intake) — every field here is optional so a
// renamed/missing key never crashes the report page, it just shows "—"
// for that one number instead.
export type GenbluReportMetric = {
  bikes_sold?: number;
  genblu_installed?: number;
  install_pct?: number;
  ecoupon_used?: number;
  ecoupon_pct?: number;
  // A bike whose loan was booked in an earlier month but got registered
  // this month has no single day within THIS month to attribute to a
  // week — it's counted here, in the monthly figures, but deliberately
  // left out of every week's own total. Only ever present on a monthly
  // total/branch/salesperson row, never on a week's.
  bikes_sold_carried_in?: number;
};

export type GenbluReportBranchRow = GenbluReportMetric & { branch?: string; name?: string };
export type GenbluReportPersonRow = GenbluReportMetric & { name?: string; branch?: string };

// One Monday-to-Saturday week (branches are closed Sundays) inside the
// month — same total/branches/salespeople shape as the whole-month
// figures, just scoped to that week's own days.
export type GenbluReportWeek = {
  week?: number;
  start?: string;
  end?: string;
  label?: string;
  total?: GenbluReportMetric;
  branches?: GenbluReportBranchRow[];
  salespeople?: GenbluReportPersonRow[];
};

export type GenbluReportPayload = {
  month?: string;
  // Confirmed against a real payload 2026-09-14: the points target field
  // is actually "ecoupon_points", not "points" as first guessed from the
  // Sales Dashboard's prose description — kept both so an older or future
  // payload using either spelling still displays.
  targets?: { install_pct?: number; ecoupon_pct?: number; points?: number; ecoupon_points?: number };
  total?: GenbluReportMetric;
  branches?: GenbluReportBranchRow[];
  salespeople?: GenbluReportPersonRow[];
  // Confirmed against real data 2026-09-14: the field is "weekly", not
  // "weeks" as first guessed.
  weekly?: GenbluReportWeek[];
  [key: string]: unknown;
};

export type GenbluReportSnapshot = {
  id: string;
  month: string;
  receivedAt: string;
  report: GenbluReportPayload;
};

// The latest delivery FOR a month ("YYYY-MM") — by the report's own month,
// not when it arrived: early in a month the Sales Dashboard sends last
// month's final report and this month's together, seconds apart.
export async function getLatestGenbluReportForMonth(monthKey: string): Promise<GenbluReportSnapshot | null> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_genblu_reports")
    .select("id, month, report, received_at")
    .eq("month", monthKey)
    .order("received_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const r = data?.[0];
  return r ? { id: r.id, month: r.month, receivedAt: r.received_at, report: r.report as GenbluReportPayload } : null;
}
