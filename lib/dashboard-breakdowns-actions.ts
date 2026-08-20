"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
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

export type PackageBreakdownRow = { name: string; count: number };

type PackageSaleRow = { branch: Branch; cc_packages: { name: string } | null };

// Which Services Combo package actually sold, not just how many total —
// grouped by package name, broken out per branch (not combined) so each
// branch's own mix is visible, same month as the rest of the dashboard.
export async function getPackageSalesBreakdown(year: number, month: number): Promise<Record<Branch, PackageBreakdownRow[]>> {
  await requireApproved();
  const { from, to } = monthRange(year, month);
  const { data, error } = await supabaseAdmin
    .from("cc_package_sales")
    .select("branch, cc_packages(name)")
    .gte("sale_date", from)
    .lte("sale_date", to);
  if (error) throw new Error(error.message);

  const typedRows = (data ?? []) as unknown as PackageSaleRow[];
  return BRANCHES.reduce(
    (acc, { value: branch }) => {
      const counts = new Map<string, number>();
      for (const row of typedRows) {
        if (row.branch !== branch) continue;
        const name = row.cc_packages?.name ?? "Unknown";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      acc[branch] = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
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
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayStr = startOfDay.toISOString().slice(0, 10);

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

export type IdleMechanic = { id: string; fullName: string; shortCode: string; branch: Branch };

// Active-status mechanics who haven't started or finished a single job
// today — a manager checking the dashboard wants to know who to check in
// with, not just who's marked Active on paper. "Today" is a job with
// started_date or completed_date equal to today, so a mechanic who wraps
// up a job counts as active even once it's no longer in the active list.
export async function getMechanicsNotActiveToday(onlyBranch?: Branch): Promise<IdleMechanic[]> {
  await requireApproved();
  const today = new Date().toISOString().slice(0, 10);

  let mechanicsQuery = supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code, branch").eq("status", "Active");
  if (onlyBranch) mechanicsQuery = mechanicsQuery.eq("branch", onlyBranch);

  const [{ data: mechanics, error: mErr }, { data: jobs, error: jErr }] = await Promise.all([
    mechanicsQuery,
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("mechanic_id")
      .or(`started_date.eq.${today},completed_date.eq.${today}`),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (jErr) throw new Error(jErr.message);

  const activeToday = new Set((jobs ?? []).map((j) => j.mechanic_id).filter(Boolean));
  return (mechanics ?? [])
    .filter((m) => !activeToday.has(m.id))
    .map((m) => ({ id: m.id, fullName: m.full_name, shortCode: m.short_code, branch: m.branch as Branch }));
}
