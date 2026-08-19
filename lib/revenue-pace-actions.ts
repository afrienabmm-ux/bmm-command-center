"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import { BRANCHES, type Branch } from "./branch";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthRange(year: number, month: number): { from: string; to: string; totalDays: number } {
  const totalDays = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(totalDays)}`, totalDays };
}

// Branches are closed Sundays — every "per day" pace figure below counts
// only Monday-to-Saturday, so it doesn't quietly assume a day the branch
// isn't even open.
function isWorkingDay(year: number, month: number, day: number): boolean {
  return new Date(year, month - 1, day).getDay() !== 0;
}

function countWorkingDays(year: number, month: number, fromDay: number, toDay: number): number {
  let count = 0;
  for (let d = fromDay; d <= toDay; d++) {
    if (d >= 1 && isWorkingDay(year, month, d)) count++;
  }
  return count;
}

export type RevenueDailyPoint = { day: number; actual: number; paceNeeded: number };

export type BranchRevenuePace = {
  branch: Branch;
  hasTarget: boolean;
  target: number;
  achieved: number;
  expectedByToday: number;
  behindAmount: number;
  onTrack: boolean;
  dailyQuota: number;
  workingDaysRemaining: number;
  revenueToday: number;
};

export type RevenuePace = {
  today: number;
  totalDays: number;
  totalWorkingDays: number;
  combinedTarget: number;
  combinedAchieved: number;
  dailyPoints: RevenueDailyPoint[];
  branches: BranchRevenuePace[];
};

type CompletedJob = { branch: Branch; revenue_amount: number; completed_date: string | null };
type SaleWithPrice = { branch: Branch; sale_date: string | null; cc_packages: { price: number } | null };

// Same "achieved" definition as the rest of the dashboard (completed repair
// job revenue + Services Combo sales revenue), just broken down by day
// instead of summed for the whole month — that's what lets this show a
// day-by-day pace instead of only a single end-of-month total.
export async function getRevenuePace(year: number, month: number): Promise<RevenuePace> {
  await requireApproved();
  const { from, to, totalDays } = monthRange(year, month);

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  const today = isCurrentMonth ? now.getDate() : isPastMonth ? totalDays : 0;

  const [{ data: targets, error: targetsErr }, { data: jobs, error: jobsErr }, { data: sales, error: salesErr }] = await Promise.all([
    supabaseAdmin
      .from("cc_monthly_targets")
      .select("branch, target_amount")
      .eq("year", year)
      .eq("month", month)
      .in(
        "branch",
        BRANCHES.map((b) => b.value)
      ),
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("branch, revenue_amount, completed_date")
      .eq("status", "Completed")
      .gte("completed_date", from)
      .lte("completed_date", to),
    supabaseAdmin.from("cc_package_sales").select("branch, sale_date, cc_packages(price)").gte("sale_date", from).lte("sale_date", to),
  ]);
  if (targetsErr) throw new Error(targetsErr.message);
  if (jobsErr) throw new Error(jobsErr.message);
  if (salesErr) throw new Error(salesErr.message);

  const typedJobs = (jobs ?? []) as unknown as CompletedJob[];
  const typedSales = (sales ?? []) as unknown as SaleWithPrice[];

  const targetByBranch = new Map<Branch, number>();
  for (const t of targets ?? []) targetByBranch.set(t.branch as Branch, Number(t.target_amount));
  const combinedTarget = BRANCHES.reduce((sum, b) => sum + (targetByBranch.get(b.value) ?? 0), 0);

  const totalWorkingDays = countWorkingDays(year, month, 1, totalDays);
  const workingDaysElapsed = countWorkingDays(year, month, 1, today);
  const workingDaysRemaining = totalWorkingDays - workingDaysElapsed;

  // amounts[branch ?? "combined"][day] = revenue earned that day.
  function dailyAmounts(branch: Branch | null): number[] {
    const amounts = new Array(totalDays + 1).fill(0);
    for (const j of typedJobs) {
      if (branch && j.branch !== branch) continue;
      if (!j.completed_date) continue;
      const day = Number(j.completed_date.slice(8, 10));
      if (day >= 1 && day <= totalDays) amounts[day] += Number(j.revenue_amount);
    }
    for (const s of typedSales) {
      if (branch && s.branch !== branch) continue;
      if (!s.sale_date) continue;
      const day = Number(s.sale_date.slice(8, 10));
      if (day >= 1 && day <= totalDays) amounts[day] += Number(s.cc_packages?.price ?? 0);
    }
    return amounts;
  }

  function expectedByDay(target: number, day: number): number {
    if (totalWorkingDays <= 0) return 0;
    return Math.round((target * countWorkingDays(year, month, 1, day)) / totalWorkingDays);
  }

  function paceFor(branch: Branch | null, target: number) {
    const amounts = dailyAmounts(branch);
    const dailyPoints: RevenueDailyPoint[] = [];
    let cumulative = 0;
    for (let d = 1; d <= totalDays; d++) {
      cumulative += amounts[d];
      dailyPoints.push({ day: d, actual: cumulative, paceNeeded: expectedByDay(target, d) });
    }
    const achieved = today >= 1 ? dailyPoints[today - 1].actual : 0;
    const expectedByToday = expectedByDay(target, today);
    const revenueToday = today >= 1 ? amounts[today] : 0;
    return { dailyPoints, achieved, expectedByToday, revenueToday };
  }

  const combined = paceFor(null, combinedTarget);

  const branchPaces: BranchRevenuePace[] = BRANCHES.map(({ value: branch }) => {
    const target = targetByBranch.get(branch) ?? 0;
    const { achieved, expectedByToday, revenueToday } = paceFor(branch, target);
    const behindAmount = Math.max(0, expectedByToday - achieved);
    // Flat quota, not a catch-up rate: RM10k target over 25 working days
    // means RM400 needed every working day, all month — it doesn't rise
    // just because yesterday was slow, or fall because today was good.
    const dailyQuota = totalWorkingDays > 0 ? Math.round(target / totalWorkingDays) : 0;
    return {
      branch,
      hasTarget: target > 0,
      target,
      achieved,
      expectedByToday,
      behindAmount,
      onTrack: achieved >= expectedByToday,
      dailyQuota,
      workingDaysRemaining: Math.max(0, workingDaysRemaining),
      revenueToday,
    };
  });

  return {
    today,
    totalDays,
    totalWorkingDays,
    combinedTarget,
    combinedAchieved: combined.achieved,
    dailyPoints: combined.dailyPoints,
    branches: branchPaces,
  };
}
