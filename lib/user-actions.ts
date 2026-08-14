"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireManagement } from "./current-user";
import type { Role, ProfileStatus } from "./current-user";
import type { BranchSelection } from "./branch";

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  homeBranch: BranchSelection;
  status: ProfileStatus;
  createdAt: string;
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
    positionTitle: r.position_title,
  };
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  await requireManagement();
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
  const approver = await requireManagement();
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

// Management-only shortcut: creates a brand new login directly (email +
// password + access level + branch), already approved — skips the usual
// sign-up-then-approve queue entirely so the person can log in right away.
export async function createUserAction(
  email: string,
  password: string,
  name: string,
  role: Role,
  homeBranch: BranchSelection,
  positionTitle: string | null = null
): Promise<{ error: string } | void> {
  const manager = await requireManagement();
  if (!email.trim()) return { error: "Enter an email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!name.trim()) return { error: "Enter a name." };

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { name: name.trim(), home_branch: homeBranch },
  });
  if (error) return { error: error.message };

  const { error: profileError } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({
      status: "approved",
      role,
      home_branch: homeBranch,
      position_title: positionTitle,
      approved_by: manager.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);
  if (profileError) return { error: profileError.message };

  revalidatePath("/team");
}

export async function updateMemberAction(
  userId: string,
  role: Role,
  homeBranch: BranchSelection,
  positionTitle: string | null = null
): Promise<void> {
  await requireManagement();
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ role, home_branch: homeBranch, position_title: positionTitle })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function revokeUserAction(userId: string): Promise<void> {
  const manager = await requireManagement();
  if (manager.id === userId) throw new Error("You can't deactivate your own access.");
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ status: "revoked" })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Brings a deactivated person back to approved, keeping their previous
// access level and branch — no need to re-pick everything from scratch.
export async function reactivateUserAction(userId: string): Promise<void> {
  await requireManagement();
  const { error } = await supabaseAdmin
    .from("cc_user_profiles")
    .update({ status: "approved" })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Permanently removes the account (not just deactivated) so their email
// address becomes available for a fresh sign-up later.
export async function deleteUserAction(userId: string): Promise<void> {
  const manager = await requireManagement();
  if (manager.id === userId) throw new Error("You can't delete your own account.");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Passwords are stored as one-way hashes and can never be read back — this
// sets a brand new password for someone who's locked out. Nothing else
// about the account changes.
export async function resetPasswordAction(userId: string, newPassword: string): Promise<{ error: string } | void> {
  await requireManagement();
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };
}
