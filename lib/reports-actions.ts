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

// Memoized per request — Reports/Dashboard pages ask for the same
// (branch, year, month) summary from multiple places in one render.
const cachedBranchMonthSummary = cache(async (branch: Branch, year: number, month: number): Promise<BranchMonthSummary> => {
  await requireApproved();
  const { from, to } = monthRange(year, month);

  // Achieved must match the same definition used everywhere else on the
  // dashboard (the Revenue trend chart, the mechanic leaderboards): completed
  // repair job revenue plus Services Combo sales revenue. Leaving packages
  // out here previously made this number silently disagree with the chart.
  const [{ data: targetRow }, { data: jobs, error: jobsError }, { data: sales, error: salesError }] = await Promise.all([
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
    supabaseAdmin
      .from("cc_package_sales")
      .select("cc_packages(price)")
      .eq("branch", branch)
      .gte("sale_date", from)
      .lte("sale_date", to),
  ]);
  if (jobsError) throw new Error(jobsError.message);
  if (salesError) throw new Error(salesError.message);

  type SaleWithPrice = { cc_packages: { price: number } | null };

  const repairRevenue = (jobs ?? []).reduce((sum, j) => sum + Number(j.revenue_amount), 0);
  const packageRevenue = ((sales ?? []) as unknown as SaleWithPrice[]).reduce(
    (sum, s) => sum + Number(s.cc_packages?.price ?? 0),
    0
  );
  return {
    branch,
    year,
    month,
    targetAmount: targetRow ? Number(targetRow.target_amount) : 0,
    achievedAmount: repairRevenue + packageRevenue,
  };
});

export async function getBranchMonthSummary(branch: Branch, year: number, month: number): Promise<BranchMonthSummary> {
  return cachedBranchMonthSummary(branch, year, month);
}

// Same "achieved" definition as the month summary above (completed repair
// job revenue plus Services Combo sales), just over an arbitrary date
// range instead of a calendar month — used for the weekly target card on
// Sales Performance.
export async function getBranchAchievedInRange(branch: Branch, from: string, to: string): Promise<number> {
  await requireApproved();
  const [{ data: jobs, error: jobsError }, { data: sales, error: salesError }] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("revenue_amount")
      .eq("branch", branch)
      .eq("status", "Completed")
      .gte("completed_date", from)
      .lte("completed_date", to),
    supabaseAdmin
      .from("cc_package_sales")
      .select("cc_packages(price)")
      .eq("branch", branch)
      .gte("sale_date", from)
      .lte("sale_date", to),
  ]);
  if (jobsError) throw new Error(jobsError.message);
  if (salesError) throw new Error(salesError.message);

  type SaleWithPrice = { cc_packages: { price: number } | null };
  const repairRevenue = (jobs ?? []).reduce((sum, j) => sum + Number(j.revenue_amount), 0);
  const packageRevenue = ((sales ?? []) as unknown as SaleWithPrice[]).reduce(
    (sum, s) => sum + Number(s.cc_packages?.price ?? 0),
    0
  );
  return repairRevenue + packageRevenue;
}

export type MonthlyTargetHistoryPoint = { year: number; month: number; achieved: number; target: number };

// Last `monthsBack` calendar months (oldest first, current month last) —
// achieved-vs-target per month, for the "Pace to Target" bar chart. Reuses
// the exact same achieved/target definition as the rest of the dashboard
// (getBranchMonthSummary), just repeated across several months instead of
// one.
export async function getMonthlyTargetHistory(
  year: number,
  month: number,
  onlyBranch?: Branch,
  monthsBack = 6
): Promise<MonthlyTargetHistoryPoint[]> {
  await requireApproved();
  const periods: { year: number; month: number }[] = [];
  let y = year;
  let m = month;
  for (let i = 0; i < monthsBack; i++) {
    periods.unshift({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return Promise.all(
    periods.map(async (p) => {
      if (onlyBranch) {
        const s = await getBranchMonthSummary(onlyBranch, p.year, p.month);
        return { year: p.year, month: p.month, achieved: s.achievedAmount, target: s.targetAmount };
      }
      const summaries = await Promise.all(BRANCHES.map(({ value }) => getBranchMonthSummary(value, p.year, p.month)));
      return {
        year: p.year,
        month: p.month,
        achieved: summaries.reduce((sum, s) => sum + s.achievedAmount, 0),
        target: summaries.reduce((sum, s) => sum + s.targetAmount, 0),
      };
    })
  );
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

    // Walk-in jobs count as soon as they start, regardless of status —
    // a mechanic's revenue credit there shouldn't wait on the job being
    // marked finished. Restore Bike is different: a bike can sit "In
    // Progress" for days/weeks, and crediting it the moment it starts made
    // "Top Restore Bike" (and this branch's leaderboard) show mechanics for
    // bikes that aren't actually done yet — so Restore Bike only counts
    // once status is Completed. Restore Bike is counted per bike (one job
    // = one bike) separately from Walk-in so "Top Restore Bike" reflects
    // only finished bike-restoration earnings, while a mechanic's overall
    // revenue is still Restore Bike + Walk-in combined.
    //
    // The jobs query is deliberately NOT filtered by branch: a job's Location
    // can be set independently of the assigned mechanic's own branch (e.g. a
    // mechanic works a job at another branch, or gets reassigned to a
    // different branch after the job was created). Filtering jobs by branch
    // here would silently drop that job from every mechanic's revenue —
    // attribution should follow the mechanic, not whatever branch value
    // happens to be stored on the job.
    const [{ data: mechanics, error: mErr }, { data: jobs, error: jErr }] = await Promise.all([
      supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code").eq("branch", branch),
      supabaseAdmin
        .from("cc_repair_jobs")
        .select("mechanic_id, job_type, revenue_amount, status")
        .gte("started_date", from)
        .lte("started_date", to),
    ]);
    if (mErr) throw new Error(mErr.message);
    if (jErr) throw new Error(jErr.message);

    return (mechanics ?? []).map((m) => {
      const own = (jobs ?? []).filter((j) => j.mechanic_id === m.id);
      const restoreBike = own.filter((j) => j.job_type === "Restore Bike" && j.status === "Completed");
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

    // Not filtered by branch — same reasoning as the repair-job query above:
    // attribute a sale to the mechanic who made it, not whatever branch
    // value the sale record happens to carry.
    const [{ data: mechanics, error: mErr }, { data: sales, error: sErr }] = await Promise.all([
      supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code").eq("branch", branch),
      supabaseAdmin
        .from("cc_package_sales")
        .select("mechanic_id, cc_packages(price)")
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

export type MechanicGenbluAchievement = {
  mechanicId: string;
  fullName: string;
  shortCode: string;
  genbluCount: number;
};

// GenBlu registrations credit whoever was logged in and did the job (their
// name, not a mechanic_id — see genblu-actions.ts), so the only way to
// attribute a registration to a mechanic is matching salesperson_name
// against the mechanic's own full_name. Not filtered by branch, same
// reasoning as the repair-job/package-sale queries above: a mechanic could
// register a customer while covering another branch, and the count should
// still follow the mechanic.
const cachedMechanicGenbluAchievements = cache(
  async (branch: Branch, year: number, month: number): Promise<MechanicGenbluAchievement[]> => {
    const { from, to } = monthRange(year, month);

    const [{ data: mechanics, error: mErr }, { data: registrations, error: gErr }] = await Promise.all([
      supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code").eq("branch", branch),
      supabaseAdmin
        .from("cc_genblu_registrations")
        .select("salesperson_name, created_at")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`),
    ]);
    if (mErr) throw new Error(mErr.message);
    if (gErr) throw new Error(gErr.message);

    const normalize = (s: string) => s.trim().toLowerCase();
    return (mechanics ?? []).map((m) => ({
      mechanicId: m.id,
      fullName: m.full_name,
      shortCode: m.short_code,
      genbluCount: (registrations ?? []).filter((r) => normalize(r.salesperson_name ?? "") === normalize(m.full_name)).length,
    }));
  }
);

export async function getMechanicGenbluAchievements(
  branch: Branch,
  year: number,
  month: number
): Promise<MechanicGenbluAchievement[]> {
  await requireApproved();
  return cachedMechanicGenbluAchievements(branch, year, month);
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
  genbluCount: number;
  totalRevenue: number;
};

// Full leaderboard for a branch: every mechanic's Restore Bike,
// package-sale, and GenBlu numbers side by side, sorted by who earned the
// most.
export async function getBranchPerformance(
  branch: Branch,
  year: number,
  month: number
): Promise<MechanicPerformanceRow[]> {
  const [repairAchievements, packageAchievements, genbluAchievements] = await Promise.all([
    getMechanicAchievements(branch, year, month),
    getMechanicPackageAchievements(branch, year, month),
    getMechanicGenbluAchievements(branch, year, month),
  ]);

  const packageByMechanic = new Map(packageAchievements.map((p) => [p.mechanicId, p]));
  const genbluByMechanic = new Map(genbluAchievements.map((g) => [g.mechanicId, g]));

  const rows = repairAchievements.map((a) => {
    const pkg = packageByMechanic.get(a.mechanicId);
    const genblu = genbluByMechanic.get(a.mechanicId);
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
      genbluCount: genblu?.genbluCount ?? 0,
      // Jobsheet (Walk-in) revenue only — Restore Bike and Services Combo
      // are shown in their own columns but don't count toward this figure,
      // the sort order, or which mechanic gets the crown.
      totalRevenue: a.walkInRevenue,
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
