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
};

export type GenbluReportBranchRow = GenbluReportMetric & { branch?: string; name?: string };
export type GenbluReportPersonRow = GenbluReportMetric & { name?: string; branch?: string };

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
  [key: string]: unknown;
};

export type GenbluReportSnapshot = {
  id: string;
  month: string;
  receivedAt: string;
  report: GenbluReportPayload;
};

// Every delivery from the Sales Dashboard is kept as its own dated row
// (see app/api/genblu-report-intake) rather than overwritten — this
// returns every snapshot received between two dates (inclusive), newest
// first, so the report page can show "as of" a specific week instead of
// only ever the latest number for the whole month. `to` is treated as the
// end of that calendar day, not midnight at its start.
export async function getGenbluReportHistoryInRange(fromDate: string, toDate: string): Promise<GenbluReportSnapshot[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_genblu_reports")
    .select("id, month, report, received_at")
    .gte("received_at", `${fromDate}T00:00:00`)
    .lte("received_at", `${toDate}T23:59:59`)
    .order("received_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    month: r.month as string,
    receivedAt: r.received_at as string,
    report: r.report as GenbluReportPayload,
  }));
}
