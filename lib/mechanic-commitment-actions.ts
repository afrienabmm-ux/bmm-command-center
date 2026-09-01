"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import type { Branch } from "./branch";
import { MECHANIC_KPI_DAILY_TARGET } from "./types";
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
  onTrack: boolean;
};

export type MechanicCommitmentSummary = {
  date: string;
  revenueTarget: number;
  rows: MechanicCommitmentRow[];
};

// Daily version — revenue/job counts are for a single target day (today by
// default, or whatever day the GM picks on Sales Performance to review a
// past day's pace), compared against the RM400/day pace reference
// (MECHANIC_KPI_DAILY_TARGET).
export async function getMechanicCommitment(branch?: Branch, targetDate?: string): Promise<MechanicCommitmentSummary> {
  await requireApproved();

  const today = targetDate ?? todayInMalaysia();
  const weekStart = startOfWeek(today);
  const dayOfWeek = toDate(today).getUTCDay();
  const daysElapsed = Math.min(dayOfWeek === 0 ? 6 : dayOfWeek, WORKING_DAYS_PER_WEEK);

  let mechanicsQuery = supabaseAdmin.from("cc_mechanics").select("id, full_name, short_code, branch").eq("status", "Active");
  if (branch) mechanicsQuery = mechanicsQuery.eq("branch", branch);

  type SaleWithPrice = { mechanic_id: string | null; cc_packages: { price: number } | null };

  const [{ data: mechanics, error: mErr }, { data: jobs, error: jErr }, { data: sales, error: sErr }] = await Promise.all([
    mechanicsQuery,
    // Jobsheet (Walk-in) revenue only — Restore Bike jobs don't count
    // toward the daily pace.
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("mechanic_id, job_type, revenue_amount, started_date")
      .eq("job_type", "Walk-in")
      .gte("started_date", weekStart)
      .lte("started_date", today),
    // Services Combo sales count toward today's revenue too — a package
    // sold today is still money brought in today, same as a jobsheet.
    supabaseAdmin.from("cc_package_sales").select("mechanic_id, cc_packages(price)").eq("sale_date", today),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (jErr) throw new Error(jErr.message);
  if (sErr) throw new Error(sErr.message);

  const rows: MechanicCommitmentRow[] = (mechanics ?? []).map((m) => {
    const weekOwn = (jobs ?? []).filter((j) => j.mechanic_id === m.id);
    const todayOwn = weekOwn.filter((j) => j.started_date === today);
    const todayPackages = ((sales ?? []) as unknown as SaleWithPrice[]).filter((s) => s.mechanic_id === m.id);
    const revenue =
      todayOwn.reduce((s, j) => s + Number(j.revenue_amount), 0) +
      todayPackages.reduce((s, sale) => s + Number(sale.cc_packages?.price ?? 0), 0);
    const restoreBikeCount = todayOwn.filter((j) => j.job_type === "Restore Bike").length;

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
