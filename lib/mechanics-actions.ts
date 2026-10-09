"use server";

import { revalidatePath, updateTag, unstable_cache } from "next/cache";
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

// The mechanic roster barely changes minute-to-minute but gets fetched on
// almost every page (Dashboard, Jobsheet, Restore Bike, Reports, Sales
// Performance) — caching it for a minute cuts a repeated round trip out
// of nearly every navigation, and every write below busts it immediately.
const cachedMechanicsByBranch = unstable_cache(
  async (branch: Branch): Promise<Mechanic[]> => {
    const { data, error } = await supabaseAdmin
      .from("cc_mechanics")
      .select("*")
      .eq("branch", branch)
      .order("full_name");
    if (error) throw new Error(error.message);
    return (data as Row[]).map(toMechanic);
  },
  ["mechanics-by-branch"],
  { revalidate: 60, tags: ["mechanics"] }
);

const cachedAllMechanics = unstable_cache(
  async (): Promise<Mechanic[]> => {
    const { data, error } = await supabaseAdmin
      .from("cc_mechanics")
      .select("*")
      .order("branch")
      .order("full_name");
    if (error) throw new Error(error.message);
    return (data as Row[]).map(toMechanic);
  },
  ["all-mechanics"],
  { revalidate: 60, tags: ["mechanics"] }
);

export async function getMechanics(branch: Branch): Promise<Mechanic[]> {
  await requireApproved();
  return cachedMechanicsByBranch(branch);
}

export async function getAllMechanics(): Promise<Mechanic[]> {
  await requireApproved();
  return cachedAllMechanics();
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
  updateTag("mechanics");
}

export async function toggleMechanicStatusAction(id: string, branch: Branch, status: MechanicStatus): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: mech } = await supabaseAdmin.from("cc_mechanics").select("full_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_mechanics").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Set mechanic status", `${mech?.full_name ?? id} → ${status}`);
  revalidatePath("/mechanics");
  updateTag("mechanics");
}

export async function updateMechanicCategoryAction(id: string, branch: Branch, category: MechanicCategory): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: mech } = await supabaseAdmin.from("cc_mechanics").select("full_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_mechanics").update({ category }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Set mechanic category", `${mech?.full_name ?? id} → ${category}`);
  revalidatePath("/mechanics");
  updateTag("mechanics");
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
}

// Moving a mechanic to another branch: their record at the old branch is set
// On Leave (so every past job there keeps their name and still counts for
// that branch), and they're made Active at the new branch — reusing their
// old record there if they've worked at that branch before, otherwise a new
// one with the same name and code.
export async function moveMechanicAction(id: string, fromBranch: Branch, toBranch: Branch): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, fromBranch);
  assertCanEditBranch(user, toBranch);
  if (fromBranch === toBranch) return { error: "Pick a different branch." };

  const { data: mech, error: readError } = await supabaseAdmin.from("cc_mechanics").select("*").eq("id", id).single();
  if (readError || !mech) return { error: readError?.message ?? "Mechanic not found." };

  const { data: existing } = await supabaseAdmin
    .from("cc_mechanics")
    .select("id")
    .eq("branch", toBranch)
    .eq("short_code", mech.short_code)
    .limit(1);
  if (existing && existing.length > 0) {
    const { error } = await supabaseAdmin.from("cc_mechanics").update({ status: "Active" }).eq("id", existing[0].id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabaseAdmin.from("cc_mechanics").insert({
      branch: toBranch,
      full_name: mech.full_name,
      short_name: mech.short_name,
      short_code: mech.short_code,
      category: mech.category,
      status: "Active",
    });
    if (error) return { error: error.message };
  }

  const { error: leaveError } = await supabaseAdmin.from("cc_mechanics").update({ status: "On Leave" }).eq("id", id);
  if (leaveError) return { error: leaveError.message };

  await logActivity(user, "Moved mechanic", `${mech.full_name} (${mech.short_code}) — ${fromBranch} → ${toBranch}`);
  revalidatePath("/mechanics");
  updateTag("mechanics");
}

// Deleting a mechanic blanks the mechanic on every job and combo sale they
// ever did (the database sets those to empty), so it's refused once they
// have any — staff moving someone to another branch should set them On
// Leave here and add them again at the new branch instead.
export async function deleteMechanicAction(id: string, branch: Branch): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const [{ count: jobCount }, { count: comboCount }] = await Promise.all([
    supabaseAdmin.from("cc_repair_jobs").select("id", { count: "exact", head: true }).eq("mechanic_id", id),
    supabaseAdmin.from("cc_package_sales").select("id", { count: "exact", head: true }).eq("mechanic_id", id),
  ]);
  if ((jobCount ?? 0) > 0 || (comboCount ?? 0) > 0) {
    return {
      error: `Can't remove — this mechanic has ${jobCount ?? 0} job${jobCount === 1 ? "" : "s"} on record, and removing them would wipe their name off every one. Set them to On Leave instead. If they moved branch, add them again at the new branch.`,
    };
  }
  const { data: mech } = await supabaseAdmin.from("cc_mechanics").select("full_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_mechanics").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Deleted mechanic", `${mech?.full_name ?? id} (${branch})`);
  revalidatePath("/mechanics");
  updateTag("mechanics");
}
