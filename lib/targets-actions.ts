"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, requireAdmin, assertCanEditBranch } from "./current-user";
import type { MonthlyTarget } from "./types";
import { BRANCHES, type Branch } from "./branch";

type Row = { id: string; branch: Branch; year: number; month: number; target_amount: number };

function toTarget(r: Row): MonthlyTarget {
  return { id: r.id, branch: r.branch, year: r.year, month: r.month, targetAmount: Number(r.target_amount) };
}

export async function getMonthlyTarget(branch: Branch, year: number, month: number): Promise<MonthlyTarget | null> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_monthly_targets")
    .select("*")
    .eq("branch", branch)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTarget(data as Row) : null;
}

export async function getAllTargetsForYear(branch: Branch, year: number): Promise<MonthlyTarget[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_monthly_targets")
    .select("*")
    .eq("branch", branch)
    .eq("year", year)
    .order("month");
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toTarget);
}

export async function setMonthlyTargetAction(
  branch: Branch,
  year: number,
  month: number,
  targetAmount: number
): Promise<void> {
  const user = await requireAdmin();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin
    .from("cc_monthly_targets")
    .upsert(
      { branch, year, month, target_amount: targetAmount, updated_at: new Date().toISOString() },
      { onConflict: "branch,year,month" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/reports");
}

// The company-wide monthly goal, split evenly across the 3 branches. This
// overwrites each branch's individual target for that month — use
// setMonthlyTargetAction instead if you want to fine-tune just one branch.
export async function setCombinedMonthlyTargetAction(year: number, month: number, overallAmount: number): Promise<void> {
  await requireAdmin();
  // Split in whole cents and hand any leftover cents to the first few
  // branches, so the 3 per-branch targets always sum back to exactly the
  // overall amount (splitting 170000 evenly by rounding each share to
  // 56666.67 would otherwise total 170000.01).
  const totalCents = Math.round(overallAmount * 100);
  const baseCents = Math.floor(totalCents / BRANCHES.length);
  const remainderCents = totalCents - baseCents * BRANCHES.length;
  const rows = BRANCHES.map(({ value: branch }, i) => ({
    branch,
    year,
    month,
    target_amount: (baseCents + (i < remainderCents ? 1 : 0)) / 100,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from("cc_monthly_targets").upsert(rows, { onConflict: "branch,year,month" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/reports");
}
