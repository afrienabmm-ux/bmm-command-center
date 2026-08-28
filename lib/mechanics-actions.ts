"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { Mechanic, MechanicStatus, MechanicCategory } from "./types";
import type { Branch } from "./branch";
import { logActivity } from "./activity-log";

type Row = {
  id: string;
  branch: Branch;
  full_name: string;
  short_name: string;
  short_code: string;
  status: MechanicStatus;
  category: MechanicCategory;
  created_at: string;
};

function toMechanic(r: Row): Mechanic {
  return {
    id: r.id,
    branch: r.branch,
    fullName: r.full_name,
    shortName: r.short_name,
    shortCode: r.short_code,
    status: r.status,
    category: r.category,
    createdAt: r.created_at,
  };
}

export async function getMechanics(branch: Branch): Promise<Mechanic[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_mechanics")
    .select("*")
    .eq("branch", branch)
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toMechanic);
}

export async function getAllMechanics(): Promise<Mechanic[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_mechanics")
    .select("*")
    .order("branch")
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toMechanic);
}

export async function addMechanicAction(input: {
  branch: Branch;
  fullName: string;
  shortName: string;
  shortCode: string;
  category?: MechanicCategory;
}): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const { error } = await supabaseAdmin.from("cc_mechanics").insert({
    branch: input.branch,
    full_name: input.fullName,
    short_name: input.shortName,
    short_code: input.shortCode.toUpperCase(),
    category: input.category ?? "Normal Repair",
  });
  if (error) throw new Error(error.message);
  await logActivity(user, "Added mechanic", `${input.fullName} (${input.shortCode.toUpperCase()}) — ${input.branch}`);
  revalidatePath("/mechanics");
}

export async function toggleMechanicStatusAction(id: string, branch: Branch, status: MechanicStatus): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: mech } = await supabaseAdmin.from("cc_mechanics").select("full_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_mechanics").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Set mechanic status", `${mech?.full_name ?? id} → ${status}`);
  revalidatePath("/mechanics");
}

export async function updateMechanicCategoryAction(id: string, branch: Branch, category: MechanicCategory): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: mech } = await supabaseAdmin.from("cc_mechanics").select("full_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_mechanics").update({ category }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Set mechanic category", `${mech?.full_name ?? id} → ${category}`);
  revalidatePath("/mechanics");
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
}

export async function deleteMechanicAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: mech } = await supabaseAdmin.from("cc_mechanics").select("full_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_mechanics").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Deleted mechanic", `${mech?.full_name ?? id} (${branch})`);
  revalidatePath("/mechanics");
}
