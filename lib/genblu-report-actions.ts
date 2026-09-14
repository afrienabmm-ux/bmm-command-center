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
  targets?: { install_pct?: number; ecoupon_pct?: number; points?: number };
  total?: GenbluReportMetric;
  branches?: GenbluReportBranchRow[];
  salespeople?: GenbluReportPersonRow[];
  [key: string]: unknown;
};

export type GenbluMonthlyReport = {
  month: string;
  receivedAt: string;
  report: GenbluReportPayload;
};

export async function getGenbluMonthlyReport(month: string): Promise<GenbluMonthlyReport | null> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_genblu_reports")
    .select("month, report, received_at")
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { month: data.month, receivedAt: data.received_at, report: data.report as GenbluReportPayload };
}
