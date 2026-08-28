"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import type { Branch } from "./branch";
import { MECHANIC_KPI_DAILY_TARGET } from "./types";

const WORKING_DAYS_PER_WEEK = 6;

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type MechanicCommitmentRow = {
  mechanicId: string;
  fullName: string;
  shortCode: string;
  branch: Branch;
  // Today only — the GM wants an up-to-date daily read, not a running
  // weekly total that only looks right by Saturday.
  revenue: number;
  jobCount: number;
  restoreBikeCount: number;
  // Consecutive working days up to and including today with at least one
  // job started — still resets each week (Monday), same streak concept as
  // before, just no longer tied to the weekly revenue total.
  streakDays: number;
  onTrack: boolean;
};

export type MechanicCommitmentSummary = {
  date: string;
  revenueTarget: number;
  rows: MechanicCommitmentRow[];
};

// Daily version — revenue/job counts are today's only, compared against
// the RM400/day pace reference (MECHANIC_KPI_DAILY_TARGET), so the numbers
// are accurate as of right now instead of accumulating all week and only
// reading correctly by Saturday.
export async function getMechanicCommitment(branch?: Branch): Promise<MechanicCommitmentSummary> {
  await requireApproved();

  const now = new Date();
  const monday = startOfWeek(now);
  const weekStart = toIso(monday);
  const today = toIso(now);
  const daysElapsed = Math.min(now.getDay() === 0 ? 6 : now.getDay(), WORKING_DAYS_PER_WEEK);

  let mechanicsQuery = supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code, branch").eq("status", "Active");
  if (branch) mechanicsQuery = mechanicsQuery.eq("branch", branch);

  const [{ data: mechanics, error: mErr }, { data: jobs, error: jErr }] = await Promise.all([
    mechanicsQuery,
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("mechanic_id, job_type, revenue_amount, started_date")
      .gte("started_date", weekStart)
      .lte("started_date", today),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (jErr) throw new Error(jErr.message);

  const rows: MechanicCommitmentRow[] = (mechanics ?? []).map((m) => {
    const weekOwn = (jobs ?? []).filter((j) => j.mechanic_id === m.id);
    const todayOwn = weekOwn.filter((j) => j.started_date === today);
    const revenue = todayOwn.reduce((s, j) => s + Number(j.revenue_amount), 0);
    const restoreBikeCount = todayOwn.filter((j) => j.job_type === "Restore Bike").length;

    let streakDays = 0;
    for (let i = 0; i < daysElapsed; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayIso = toIso(day);
      if (!weekOwn.some((j) => j.started_date === dayIso)) break;
      streakDays++;
    }

    return {
      mechanicId: m.id,
      fullName: m.full_name,
      shortCode: m.short_code,
      branch: m.branch as Branch,
      revenue,
      jobCount: todayOwn.length,
      restoreBikeCount,
      streakDays,
      onTrack: revenue >= MECHANIC_KPI_DAILY_TARGET,
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue);

  return { date: today, revenueTarget: MECHANIC_KPI_DAILY_TARGET, rows };
}
