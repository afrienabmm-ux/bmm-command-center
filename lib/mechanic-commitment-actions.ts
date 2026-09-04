"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import { BRANCHES, type Branch } from "./branch";
import { MECHANIC_KPI_WORKING_DAYS } from "./types";
import { todayInMalaysia } from "./malaysia-time";

const WORKING_DAYS_PER_WEEK = 6;

// Anchored to UTC midnight of the given YYYY-MM-DD string, and read back
// out via getUTC*/toISOString — so results never depend on the host
// machine's own timezone. Parsing a date-only string as local time (e.g.
// `new Date(iso + "T00:00:00")`) silently shifts the calendar day back by
// one when the host's local zone is ahead of UTC, like Asia/Kuala_Lumpur.
function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(iso: string): string {
  const d = toDate(iso);
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return toIso(d);
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
  // This mechanic's own branch's monthly target, divided by 25 working
  // days and then split evenly across every active mechanic at that
  // branch — not a flat company-wide number, since branches carry
  // different targets and headcounts.
  dailyTarget: number;
  onTrack: boolean;
};

export type MechanicCommitmentSummary = {
  date: string;
  // Per-branch daily target (see MechanicCommitmentRow.dailyTarget) — a
  // single flat number no longer makes sense once it depends on each
  // branch's own target and headcount, so callers needing a team total
  // should sum the relevant rows' own dailyTarget instead.
  dailyTargetByBranch: Record<Branch, number>;
  rows: MechanicCommitmentRow[];
};

// Daily version — revenue/job counts are for a single target day (today by
// default, or whatever day the GM picks on Sales Performance to review a
// past day's pace), compared against each mechanic's own share of their
// branch's monthly target (that branch's target ÷ 25 working days ÷ how
// many mechanics are active there).
export async function getMechanicCommitment(branch?: Branch, targetDate?: string): Promise<MechanicCommitmentSummary> {
  await requireApproved();

  const today = targetDate ?? todayInMalaysia();
  const weekStart = startOfWeek(today);
  const dayOfWeek = toDate(today).getUTCDay();
  const daysElapsed = Math.min(dayOfWeek === 0 ? 6 : dayOfWeek, WORKING_DAYS_PER_WEEK);
  const [targetYear, targetMonth] = today.split("-").map(Number);

  let mechanicsQuery = supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code, branch").eq("status", "Active");
  if (branch) mechanicsQuery = mechanicsQuery.eq("branch", branch);

  let targetsQuery = supabaseAdmin
    .from("cc_monthly_targets")
    .select("branch, target_amount")
    .eq("year", targetYear)
    .eq("month", targetMonth);
  if (branch) targetsQuery = targetsQuery.eq("branch", branch);

  const [{ data: mechanics, error: mErr }, { data: jobs, error: jErr }, { data: targets, error: tErr }] = await Promise.all([
    mechanicsQuery,
    // Jobsheet (Walk-in) revenue only — Restore Bike jobs don't count
    // toward the daily pace.
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("mechanic_id, job_type, revenue_amount, started_date")
      .eq("job_type", "Walk-in")
      .gte("started_date", weekStart)
      .lte("started_date", today),
    targetsQuery,
  ]);
  if (mErr) throw new Error(mErr.message);
  if (jErr) throw new Error(jErr.message);
  if (tErr) throw new Error(tErr.message);

  const monthlyTargetByBranch = new Map<Branch, number>();
  for (const t of targets ?? []) monthlyTargetByBranch.set(t.branch as Branch, Number(t.target_amount));

  const mechanicCountByBranch = new Map<Branch, number>();
  for (const m of mechanics ?? []) {
    const b = m.branch as Branch;
    mechanicCountByBranch.set(b, (mechanicCountByBranch.get(b) ?? 0) + 1);
  }

  const dailyTargetByBranch = Object.fromEntries(
    BRANCHES.map(({ value: b }) => {
      const monthlyTarget = monthlyTargetByBranch.get(b) ?? 0;
      const mechanicCount = mechanicCountByBranch.get(b) ?? 0;
      const target = mechanicCount > 0 ? Math.round(monthlyTarget / MECHANIC_KPI_WORKING_DAYS / mechanicCount) : 0;
      return [b, target];
    })
  ) as Record<Branch, number>;

  const rows: MechanicCommitmentRow[] = (mechanics ?? []).map((m) => {
    const mechanicBranch = m.branch as Branch;
    const weekOwn = (jobs ?? []).filter((j) => j.mechanic_id === m.id);
    const todayOwn = weekOwn.filter((j) => j.started_date === today);
    const revenue = todayOwn.reduce((s, j) => s + Number(j.revenue_amount), 0);
    const restoreBikeCount = todayOwn.filter((j) => j.job_type === "Restore Bike").length;
    const dailyTarget = dailyTargetByBranch[mechanicBranch] ?? 0;

    let streakDays = 0;
    for (let i = 0; i < daysElapsed; i++) {
      const day = toDate(weekStart);
      day.setUTCDate(day.getUTCDate() + i);
      const dayIso = toIso(day);
      if (!weekOwn.some((j) => j.started_date === dayIso)) break;
      streakDays++;
    }

    return {
      mechanicId: m.id,
      fullName: m.full_name,
      shortCode: m.short_code,
      branch: mechanicBranch,
      revenue,
      jobCount: todayOwn.length,
      restoreBikeCount,
      streakDays,
      dailyTarget,
      onTrack: revenue >= dailyTarget,
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue);

  return { date: today, dailyTargetByBranch, rows };
}
