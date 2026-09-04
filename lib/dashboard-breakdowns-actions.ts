"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import { todayInMalaysia } from "./malaysia-time";
import { CLAIM_STATUSES, type ClaimStatus } from "./types";
import { BRANCHES, type Branch } from "./branch";

function monthRange(year: number, month: number): { from: string; to: string } {
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${year}-${monthStr}-01`, to: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}` };
}

export type ClaimStatusBreakdownRow = { status: ClaimStatus; count: number };

// Shared by both claim tables (identical status/submitted_date/branch
// columns) — all branches combined by default (or just onlyBranch, for the
// single-branch dashboard view), scoped to the same month as the rest of
// the dashboard. Every status is included even at zero so the legend never
// silently drops a category the moment nothing's in it this month.
async function claimStatusBreakdown(
  table: "cc_warranty_claims" | "cc_delivery_claims",
  year: number,
  month: number,
  onlyBranch?: Branch
): Promise<ClaimStatusBreakdownRow[]> {
  const { from, to } = monthRange(year, month);
  let query = supabaseAdmin.from(table).select("status").gte("submitted_date", from).lte("submitted_date", to);
  if (onlyBranch) query = query.eq("branch", onlyBranch);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const counts = new Map<ClaimStatus, number>(CLAIM_STATUSES.map((s) => [s, 0]));
  for (const row of data ?? []) {
    const status = row.status as ClaimStatus;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return CLAIM_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

export async function getWarrantyClaimStatusBreakdown(
  year: number,
  month: number,
  onlyBranch?: Branch
): Promise<ClaimStatusBreakdownRow[]> {
  await requireApproved();
  return claimStatusBreakdown("cc_warranty_claims", year, month, onlyBranch);
}

export async function getDeliveryClaimStatusBreakdown(
  year: number,
  month: number,
  onlyBranch?: Branch
): Promise<ClaimStatusBreakdownRow[]> {
  await requireApproved();
  return claimStatusBreakdown("cc_delivery_claims", year, month, onlyBranch);
}

// Which mechanic sold which package, not just a count — a plain list is
// more useful to check than a pie chart when you actually want to know who
// sold what.
export type PackageBreakdownRow = {
  packageName: string;
  mechanicLabel: string;
  customerName: string;
  saleDate: string;
  // Falls back to the jobsheet number when the combo was rung up on the
  // same receipt (the common case — see WalkInJobForm's comboReceiptId).
  receiptId: string;
};

type PackageSaleRow = {
  branch: Branch;
  sale_date: string;
  customer_name: string | null;
  receipt_id: string | null;
  cc_packages: { name: string } | null;
  cc_mechanics: { short_code: string; short_name: string } | null;
};

export async function getPackageSalesBreakdown(year: number, month: number): Promise<Record<Branch, PackageBreakdownRow[]>> {
  await requireApproved();
  const { from, to } = monthRange(year, month);
  const { data, error } = await supabaseAdmin
    .from("cc_package_sales")
    .select("branch, sale_date, customer_name, receipt_id, cc_packages(name), cc_mechanics(short_code, short_name)")
    .gte("sale_date", from)
    .lte("sale_date", to)
    .order("sale_date", { ascending: false });
  if (error) throw new Error(error.message);

  const typedRows = (data ?? []) as unknown as PackageSaleRow[];
  return BRANCHES.reduce(
    (acc, { value: branch }) => {
      acc[branch] = typedRows
        .filter((row) => row.branch === branch)
        .map((row) => ({
          packageName: row.cc_packages?.name ?? "Unknown",
          mechanicLabel: row.cc_mechanics ? `${row.cc_mechanics.short_name} (${row.cc_mechanics.short_code})` : "—",
          customerName: row.customer_name || "—",
          saleDate: row.sale_date,
          receiptId: row.receipt_id || "—",
        }));
      return acc;
    },
    {} as Record<Branch, PackageBreakdownRow[]>
  );
}

export type TodayActivity = { jobsheetCount: number; restoreBikeCount: number; packagesSoldCount: number };

// How many jobsheets, Restore Bike jobs, and Services Combo sales were
// added today — a rolling daily snapshot, not a month total, so it's
// naturally different every morning rather than accumulating. "Added" =
// created_at (or sale_date, for packages) is today, which stays true
// regardless of whatever happens to the job's status afterward.
export async function getTodayActivity(onlyBranch?: Branch): Promise<TodayActivity> {
  await requireApproved();
  const todayStr = todayInMalaysia();
  // Malaysia midnight, expressed as the correct UTC instant — not the
  // host's own midnight, which is 8 hours off from Malaysia on Vercel (UTC).
  const startOfDay = new Date(`${todayStr}T00:00:00+08:00`);

  let jobsQuery = supabaseAdmin.from("cc_repair_jobs").select("job_type").gte("created_at", startOfDay.toISOString());
  if (onlyBranch) jobsQuery = jobsQuery.eq("branch", onlyBranch);

  let packagesQuery = supabaseAdmin.from("cc_package_sales").select("id", { count: "exact", head: true }).eq("sale_date", todayStr);
  if (onlyBranch) packagesQuery = packagesQuery.eq("branch", onlyBranch);

  const [{ data, error }, { count: packagesSoldCount, error: pkgError }] = await Promise.all([jobsQuery, packagesQuery]);
  if (error) throw new Error(error.message);
  if (pkgError) throw new Error(pkgError.message);

  const jobCounts = (data ?? []).reduce(
    (acc, row) => {
      if (row.job_type === "Walk-in") acc.jobsheetCount += 1;
      else if (row.job_type === "Restore Bike") acc.restoreBikeCount += 1;
      return acc;
    },
    { jobsheetCount: 0, restoreBikeCount: 0 }
  );

  return { ...jobCounts, packagesSoldCount: packagesSoldCount ?? 0 };
}

