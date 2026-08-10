"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireManager } from "./current-user";
import type { Role, ProfileStatus } from "./current-user";
import type { Branch } from "./branch";
import { resolveAllowedPages, type PageKey } from "./permissions";

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  homeBranch: Branch;
  status: ProfileStatus;
  createdAt: string;
  allowedPages: PageKey[];
  hasCustomPages: boolean;
};

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  home_branch: Branch;
  status: ProfileStatus;
  created_at: string;
  allowed_pages: string[] | null;
};

function toMember(r: ProfileRow): TeamMember {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    homeBranch: r.home_branch,
    status: r.status,
    createdAt: r.created_at,
    allowedPages: resolveAllowedPages(r.role, r.allowed_pages),
    hasCustomPages: r.allowed_pages !== null,
  };
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  await requireManager();
  const { data, error } = await supabaseAdmin
    .from("cc_user_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map(toMember);
}

export async function approveUserAction(userId: string, role: Role, homeBranch: Branch): Promise<void> {
  const manager = await requireManager();
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ status: "approved", role, home_branch: homeBranch, approved_by: manager.id, approved_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function updateMemberAction(userId: string, role: Role, homeBranch: Branch): Promise<void> {
  await requireManager();
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ role, home_branch: homeBranch })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Custom per-person function access (the "which screens can this person
// see" toggle list). Passing null resets them back to their role's default.
export async function updateMemberPagesAction(userId: string, pages: PageKey[] | null): Promise<void> {
  await requireManager();
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ allowed_pages: pages })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function revokeUserAction(userId: string): Promise<void> {
  const manager = await requireManager();
  if (manager.id === userId) throw new Error("You can't revoke your own access.");
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ status: "revoked" })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}
