"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import type { Branch } from "./branch";
import { MECHANIC_WEEKLY_REVENUE_TARGET } from "./types";

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
  revenue: number;
  jobCount: number;
  restoreBikeCount: number;
  // Consecutive working days from Monday with at least one job started —
  // resets fresh each week, not a running best-ever streak.
  streakDays: number;
  onTrack: boolean;
};

export type MechanicCommitmentSummary = {
  weekStart: string;
  weekEnd: string;
  daysElapsed: number;
  revenueTarget: number;
  rows: MechanicCommitmentRow[];
};

// Weekly version of getMechanicAchievements (reports-actions.ts) — same
// started_date attribution (credit follows when the job started, not when
// it's finished), scoped to the current Monday-through-today window
// instead of a calendar month. Pass a branch to scope to one branch, or
// omit for every branch at once.
export async function getMechanicCommitment(branch?: Branch): Promise<MechanicCommitmentSummary> {
  await requireApproved();

  const now = new Date();
  const monday = startOfWeek(now);
  const weekStart = toIso(monday);
  const weekEnd = toIso(now);
  // How many working days into the week so far — Sunday doesn't add a new
  // working day toward the pace reference (day 0 means the week just
  // reset, so everything still compares against the prior Saturday's 6).
  const daysElapsed = Math.min(now.getDay() === 0 ? 6 : now.getDay(), WORKING_DAYS_PER_WEEK);

  let mechanicsQuery = supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code, branch").eq("status", "Active");
  if (branch) mechanicsQuery = mechanicsQuery.eq("branch", branch);

  const [{ data: mechanics, error: mErr }, { data: jobs, error: jErr }] = await Promise.all([
    mechanicsQuery,
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("mechanic_id, job_type, revenue_amount, started_date")
      .gte("started_date", weekStart)
      .lte("started_date", weekEnd),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (jErr) throw new Error(jErr.message);

  const rows: MechanicCommitmentRow[] = (mechanics ?? []).map((m) => {
    const own = (jobs ?? []).filter((j) => j.mechanic_id === m.id);
    const revenue = own.reduce((s, j) => s + Number(j.revenue_amount), 0);
    const restoreBikeCount = own.filter((j) => j.job_type === "Restore Bike").length;

    let streakDays = 0;
    for (let i = 0; i < daysElapsed; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayIso = toIso(day);
      if (!own.some((j) => j.started_date === dayIso)) break;
      streakDays++;
    }

    const expectedSoFar = (MECHANIC_WEEKLY_REVENUE_TARGET / WORKING_DAYS_PER_WEEK) * daysElapsed;
    const onTrack = revenue >= expectedSoFar;

    return {
      mechanicId: m.id,
      fullName: m.full_name,
      shortCode: m.short_code,
      branch: m.branch as Branch,
      revenue,
      jobCount: own.length,
      restoreBikeCount,
      streakDays,
      onTrack,
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue);

  return { weekStart, weekEnd, daysElapsed, revenueTarget: MECHANIC_WEEKLY_REVENUE_TARGET, rows };
}
