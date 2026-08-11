"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireManager, requireManagerOrIT } from "./current-user";
import type { Role, ProfileStatus } from "./current-user";
import type { BranchSelection } from "./branch";
import { resolveAllowedPages, type PageKey } from "./permissions";

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  homeBranch: BranchSelection;
  status: ProfileStatus;
  createdAt: string;
  allowedPages: PageKey[];
  hasCustomPages: boolean;
  positionTitle: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  home_branch: BranchSelection;
  status: ProfileStatus;
  created_at: string;
  allowed_pages: string[] | null;
  position_title: string | null;
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
    positionTitle: r.position_title,
  };
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  await requireManagerOrIT();
  const { data, error } = await supabaseAdmin
    .from("cc_user_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map(toMember);
}

export async function approveUserAction(
  userId: string,
  role: Role,
  homeBranch: BranchSelection,
  positionTitle: string | null = null
): Promise<void> {
  const approver = await requireManagerOrIT();
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({
      status: "approved",
      role,
      home_branch: homeBranch,
      position_title: positionTitle,
      approved_by: approver.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function updateMemberAction(
  userId: string,
  role: Role,
  homeBranch: BranchSelection,
  positionTitle: string | null = null
): Promise<void> {
  await requireManager();
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ role, home_branch: homeBranch, position_title: positionTitle })
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

// Brings a revoked person back to approved, keeping their previous role and
// branch — no need to re-pick everything from scratch.
export async function reactivateUserAction(userId: string): Promise<void> {
  await requireManager();
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ status: "approved" })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Permanently removes the account (not just revoked) so their email address
// becomes available for a fresh sign-up later.
export async function deleteUserAction(userId: string): Promise<void> {
  const manager = await requireManager();
  if (manager.id === userId) throw new Error("You can't delete your own account.");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Passwords are stored as one-way hashes and can never be read back — this
// sets a brand new password for someone who's locked out. IT and Manager
// both get this; nothing else about the account changes.
export async function resetPasswordAction(userId: string, newPassword: string): Promise<{ error: string } | void> {
  await requireManagerOrIT();
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };
}
