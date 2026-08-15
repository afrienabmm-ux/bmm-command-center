"use server";

import { cache } from "react";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import { BRANCHES, type Branch } from "./branch";

function monthRange(year: number, month: number): { from: string; to: string } {
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${year}-${monthStr}-01`, to: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}` };
}

export type BranchMonthSummary = {
  branch: Branch;
  year: number;
  month: number;
  targetAmount: number;
  achievedAmount: number;
};

export async function getBranchMonthSummary(branch: Branch, year: number, month: number): Promise<BranchMonthSummary> {
  await requireApproved();
  const { from, to } = monthRange(year, month);

  const [{ data: targetRow }, { data: jobs, error }] = await Promise.all([
    supabaseAdmin
      .from("cc_monthly_targets")
      .select("target_amount")
      .eq("branch", branch)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle(),
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("revenue_amount")
      .eq("branch", branch)
      .eq("status", "Completed")
      .gte("completed_date", from)
      .lte("completed_date", to),
  ]);
  if (error) throw new Error(error.message);

  const achievedAmount = (jobs ?? []).reduce((sum, j) => sum + Number(j.revenue_amount), 0);
  return {
    branch,
    year,
    month,
    targetAmount: targetRow ? Number(targetRow.target_amount) : 0,
    achievedAmount,
  };
}

export type MechanicAchievement = {
  mechanicId: string;
  fullName: string;
  shortCode: string;
  restoreBikeCount: number;
  restoreBikeRevenue: number;
  walkInCount: number;
  walkInRevenue: number;
  totalRevenue: number;
};

// Memoized per request: the dashboard reaches this from three different
// places (top overall, top restore bike, and the full leaderboard) for the
// same branch and month, so without cache() it ran the same two queries 9
// times over. The exported wrapper stays a plain async function because
// "use server" modules may only export those.
const cachedMechanicAchievements = cache(
  async (branch: Branch, year: number, month: number): Promise<MechanicAchievement[]> => {
    const { from, to } = monthRange(year, month);

    // Counts every job assigned this month regardless of status (Pending/In
    // Progress/Completed) — a mechanic's revenue credit shouldn't wait on
    // the job being marked finished, only on when it started. Restore Bike
    // is counted per bike (one job = one bike) separately from Walk-in so
    // "Top Restore Bike" reflects only bike-restoration earnings, while a
    // mechanic's overall revenue is still Restore Bike + Walk-in combined.
    const [{ data: mechanics, error: mErr }, { data: jobs, error: jErr }] = await Promise.all([
      supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code").eq("branch", branch),
      supabaseAdmin
        .from("cc_repair_jobs")
        .select("mechanic_id, job_type, revenue_amount")
        .eq("branch", branch)
        .gte("started_date", from)
        .lte("started_date", to),
    ]);
    if (mErr) throw new Error(mErr.message);
    if (jErr) throw new Error(jErr.message);

    return (mechanics ?? []).map((m) => {
      const own = (jobs ?? []).filter((j) => j.mechanic_id === m.id);
      const restoreBike = own.filter((j) => j.job_type === "Restore Bike");
      const walkIn = own.filter((j) => j.job_type === "Walk-in");
      const restoreBikeRevenue = restoreBike.reduce((s, j) => s + Number(j.revenue_amount), 0);
      const walkInRevenue = walkIn.reduce((s, j) => s + Number(j.revenue_amount), 0);
      return {
        mechanicId: m.id,
        fullName: m.full_name,
        shortCode: m.short_code,
        restoreBikeCount: restoreBike.length,
        restoreBikeRevenue,
        walkInCount: walkIn.length,
        walkInRevenue,
        totalRevenue: restoreBikeRevenue + walkInRevenue,
      };
    });
  }
);

export async function getMechanicAchievements(
  branch: Branch,
  year: number,
  month: number
): Promise<MechanicAchievement[]> {
  await requireApproved();
  return cachedMechanicAchievements(branch, year, month);
}

export type MechanicPackageAchievement = {
  mechanicId: string;
  fullName: string;
  shortCode: string;
  setsSold: number;
  revenue: number;
};

const cachedMechanicPackageAchievements = cache(
  async (branch: Branch, year: number, month: number): Promise<MechanicPackageAchievement[]> => {
    const { from, to } = monthRange(year, month);

    const [{ data: mechanics, error: mErr }, { data: sales, error: sErr }] = await Promise.all([
      supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code").eq("branch", branch),
      supabaseAdmin
        .from("cc_package_sales")
        .select("mechanic_id, cc_packages(price)")
        .eq("branch", branch)
        .gte("sale_date", from)
        .lte("sale_date", to),
    ]);
    if (mErr) throw new Error(mErr.message);
    if (sErr) throw new Error(sErr.message);

    type SaleWithPrice = { mechanic_id: string | null; cc_packages: { price: number } | null };

    return (mechanics ?? []).map((m) => {
      const own = ((sales ?? []) as unknown as SaleWithPrice[]).filter((s) => s.mechanic_id === m.id);
      return {
        mechanicId: m.id,
        fullName: m.full_name,
        shortCode: m.short_code,
        setsSold: own.length,
        revenue: own.reduce((sum, s) => sum + Number(s.cc_packages?.price ?? 0), 0),
      };
    });
  }
);

export async function getMechanicPackageAchievements(
  branch: Branch,
  year: number,
  month: number
): Promise<MechanicPackageAchievement[]> {
  await requireApproved();
  return cachedMechanicPackageAchievements(branch, year, month);
}

export type TopMechanic = {
  fullName: string;
  shortCode: string;
  totalRevenue: number;
};

// Combines repair-job revenue and package-sale revenue per mechanic, then
// returns whoever earned the most for that branch this month.
export async function getTopMechanic(branch: Branch, year: number, month: number): Promise<TopMechanic | null> {
  const [repairAchievements, packageAchievements] = await Promise.all([
    getMechanicAchievements(branch, year, month),
    getMechanicPackageAchievements(branch, year, month),
  ]);

  const combined = new Map<string, TopMechanic>();
  for (const a of repairAchievements) {
    combined.set(a.mechanicId, { fullName: a.fullName, shortCode: a.shortCode, totalRevenue: a.totalRevenue });
  }
  for (const a of packageAchievements) {
    const existing = combined.get(a.mechanicId);
    if (existing) {
      existing.totalRevenue += a.revenue;
    } else {
      combined.set(a.mechanicId, { fullName: a.fullName, shortCode: a.shortCode, totalRevenue: a.revenue });
    }
  }

  let top: TopMechanic | null = null;
  for (const m of combined.values()) {
    if (m.totalRevenue > 0 && (!top || m.totalRevenue > top.totalRevenue)) top = m;
  }
  return top;
}

// Same as getTopMechanic, but ranked by Restore Bike revenue only.
export async function getTopRestoreBikeMechanic(
  branch: Branch,
  year: number,
  month: number
): Promise<TopMechanic | null> {
  const achievements = await getMechanicAchievements(branch, year, month);
  let top: TopMechanic | null = null;
  for (const a of achievements) {
    if (a.restoreBikeRevenue > 0 && (!top || a.restoreBikeRevenue > top.totalRevenue)) {
      top = { fullName: a.fullName, shortCode: a.shortCode, totalRevenue: a.restoreBikeRevenue };
    }
  }
  return top;
}

export type MechanicPerformanceRow = {
  mechanicId: string;
  fullName: string;
  shortCode: string;
  restoreBikeRevenue: number;
  restoreBikeCount: number;
  walkInRevenue: number;
  walkInCount: number;
  packageRevenue: number;
  packageSetsSold: number;
  totalRevenue: number;
};

// Full leaderboard for a branch: every mechanic's Restore Bike and
// package-sale numbers side by side, sorted by who earned the most.
export async function getBranchPerformance(
  branch: Branch,
  year: number,
  month: number
): Promise<MechanicPerformanceRow[]> {
  const [repairAchievements, packageAchievements] = await Promise.all([
    getMechanicAchievements(branch, year, month),
    getMechanicPackageAchievements(branch, year, month),
  ]);

  const packageByMechanic = new Map(packageAchievements.map((p) => [p.mechanicId, p]));

  const rows = repairAchievements.map((a) => {
    const pkg = packageByMechanic.get(a.mechanicId);
    return {
      mechanicId: a.mechanicId,
      fullName: a.fullName,
      shortCode: a.shortCode,
      restoreBikeRevenue: a.restoreBikeRevenue,
      restoreBikeCount: a.restoreBikeCount,
      walkInRevenue: a.walkInRevenue,
      walkInCount: a.walkInCount,
      packageRevenue: pkg?.revenue ?? 0,
      packageSetsSold: pkg?.setsSold ?? 0,
      totalRevenue: a.totalRevenue + (pkg?.revenue ?? 0),
    };
  });

  return rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export type MechanicPerformanceRowWithBranch = MechanicPerformanceRow & { branch: Branch };

// Same leaderboard as getBranchPerformance, but merged across all 3 branches
// so a Manager can see every mechanic's individual numbers at once.
export async function getAllBranchesPerformance(year: number, month: number): Promise<MechanicPerformanceRowWithBranch[]> {
  const perBranch = await Promise.all(
    BRANCHES.map(async ({ value: branch }) => {
      const rows = await getBranchPerformance(branch, year, month);
      return rows.map((r) => ({ ...r, branch }));
    })
  );
  return perBranch.flat().sort((a, b) => b.totalRevenue - a.totalRevenue);
}
