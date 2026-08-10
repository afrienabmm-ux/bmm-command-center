"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import type { Branch } from "./branch";
import type { JobType } from "./types";

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

export async function getMechanicAchievements(
  branch: Branch,
  year: number,
  month: number
): Promise<MechanicAchievement[]> {
  await requireApproved();
  const { from, to } = monthRange(year, month);

  const [{ data: mechanics, error: mErr }, { data: jobs, error: jErr }] = await Promise.all([
    supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code").eq("branch", branch),
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("mechanic_id, job_type, revenue_amount")
      .eq("branch", branch)
      .eq("status", "Completed")
      .gte("completed_date", from)
      .lte("completed_date", to),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (jErr) throw new Error(jErr.message);

  return (mechanics ?? []).map((m) => {
    const own = (jobs ?? []).filter((j) => j.mechanic_id === m.id);
    const restore = own.filter((j) => j.job_type === ("Restore Bike" as JobType));
    const walkIn = own.filter((j) => j.job_type === ("Walk-in" as JobType));
    return {
      mechanicId: m.id,
      fullName: m.full_name,
      shortCode: m.short_code,
      restoreBikeCount: restore.length,
      restoreBikeRevenue: restore.reduce((s, j) => s + Number(j.revenue_amount), 0),
      walkInCount: walkIn.length,
      walkInRevenue: walkIn.reduce((s, j) => s + Number(j.revenue_amount), 0),
      totalRevenue: own.reduce((s, j) => s + Number(j.revenue_amount), 0),
    };
  });
}

export type MechanicPackageAchievement = {
  mechanicId: string;
  fullName: string;
  shortCode: string;
  setsSold: number;
  revenue: number;
};

export async function getMechanicPackageAchievements(
  branch: Branch,
  year: number,
  month: number
): Promise<MechanicPackageAchievement[]> {
  await requireApproved();
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
