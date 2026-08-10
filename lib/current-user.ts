import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase-auth-server";
import { supabaseAdmin } from "./supabase-server";
import type { Branch, BranchSelection } from "./branch";
import { getSelectedBranch, getRawBranchSelection } from "./branch-server";
import { resolveAllowedPages, type PageKey } from "./permissions";

export type Role = "Manager" | "Admin" | "Mechanic PIC" | "IT";
export type ProfileStatus = "pending" | "approved" | "revoked";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  homeBranch: BranchSelection;
  status: ProfileStatus;
  pages: PageKey[];
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("cc_user_profiles")
    .select("name, role, home_branch, status, allowed_pages")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile.name ?? "",
    role: profile.role,
    homeBranch: profile.home_branch,
    status: profile.status,
    pages: resolveAllowedPages(profile.role, profile.allowed_pages),
  };
}

export async function requireApproved(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved") {
    throw new Error("Your account isn't approved yet.");
  }
  return user;
}

// Manager and Admin both get admin-level powers (edit targets, edit any
// branch's data). Only Manager can additionally approve accounts and set
// permissions — see requireManager below.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireApproved();
  if (user.role !== "Admin" && user.role !== "Manager") {
    throw new Error("Only a Manager or Admin can do this.");
  }
  return user;
}

export async function requireManager(): Promise<CurrentUser> {
  const user = await requireApproved();
  if (user.role !== "Manager") {
    throw new Error("Only a Manager can do this.");
  }
  return user;
}

// IT gets a narrow slice of Manager power: just enough to see the team list
// and reset a locked-out person's password. Everything else (roles,
// branches, approvals, revoke/delete) stays Manager-only.
export async function requireManagerOrIT(): Promise<CurrentUser> {
  const user = await requireApproved();
  if (user.role !== "Manager" && user.role !== "IT") {
    throw new Error("Only a Manager or IT can do this.");
  }
  return user;
}

export function hasPageAccess(user: CurrentUser, page: PageKey): boolean {
  return user.pages.includes(page);
}

export async function requirePage(page: PageKey): Promise<CurrentUser> {
  const user = await requireApproved();
  if (!hasPageAccess(user, page)) {
    redirect("/");
  }
  return user;
}

// A person can view/switch every branch if their role grants it (Admin,
// Manager, IT) OR a Manager has explicitly set their individual branch to
// "All Branches" on the Team page — independent of role.
export function canViewAllBranches(user: CurrentUser): boolean {
  return user.role === "Admin" || user.role === "Manager" || user.role === "IT" || user.homeBranch === "all";
}

export function canViewAllBranchesAtOnce(user: CurrentUser): boolean {
  return canViewAllBranches(user);
}

export async function getActiveBranch(user: CurrentUser): Promise<Branch> {
  if (!canViewAllBranches(user)) return user.homeBranch as Branch;
  return getSelectedBranch(user.homeBranch === "all" ? "kapar" : user.homeBranch);
}

// For pages that know how to render a combined "All Branches" view.
export async function getActiveBranchSelection(user: CurrentUser): Promise<BranchSelection> {
  if (!canViewAllBranchesAtOnce(user)) return getActiveBranch(user);
  return getRawBranchSelection(user.homeBranch === "all" ? "kapar" : user.homeBranch);
}

export function assertCanEditBranch(user: CurrentUser, branch: Branch) {
  if (canViewAllBranches(user)) return;
  if (user.homeBranch !== branch) {
    throw new Error("You can only edit data for your own branch.");
  }
}

export async function requirePageContext(): Promise<{ user: CurrentUser; branch: Branch }> {
  const user = await requireApproved();
  const branch = await getActiveBranch(user);
  return { user, branch };
}
