"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { Mechanic, MechanicStatus } from "./types";
import type { Branch } from "./branch";

type Row = {
  id: string;
  branch: Branch;
  full_name: string;
  short_name: string;
  short_code: string;
  status: MechanicStatus;
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

export async function addMechanicAction(input: {
  branch: Branch;
  fullName: string;
  shortName: string;
  shortCode: string;
}): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const { error } = await supabaseAdmin.from("cc_mechanics").insert({
    branch: input.branch,
    full_name: input.fullName,
    short_name: input.shortName,
    short_code: input.shortCode.toUpperCase(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/mechanics");
}

export async function toggleMechanicStatusAction(id: string, branch: Branch, status: MechanicStatus): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_mechanics").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/mechanics");
}

export async function deleteMechanicAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_mechanics").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/mechanics");
}
