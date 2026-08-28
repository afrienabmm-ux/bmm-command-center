import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase-auth-server";
import { supabaseAdmin } from "./supabase-server";
import type { Branch, BranchSelection } from "./branch";
import { getSelectedBranch, getRawBranchSelection } from "./branch-server";
import { resolveAllowedPages, type PageKey } from "./permissions";

// Mechanic is a narrower access level than Branch PIC — see
// resolveAllowedPages in permissions.ts for exactly what it can see
// (jobsheet scanning only, nothing else).
export type Role = "Branch PIC" | "Management" | "Mechanic";
export type ProfileStatus = "pending" | "approved" | "revoked";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  positionTitle: string | null;
  homeBranch: BranchSelection;
  status: ProfileStatus;
  pages: PageKey[];
};

// Wrapped in React's cache() so the token check and profile lookup happen
// once per request instead of once per permission check. Every data function
// calls requireApproved(), which meant a single dashboard load was asking
// "who is this user?" ~44 times — two network round-trips each.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("cc_user_profiles")
    .select("name, role, home_branch, status, position_title")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile.name ?? "",
    role: profile.role,
    positionTitle: profile.position_title,
    homeBranch: profile.home_branch,
    status: profile.status,
    pages: resolveAllowedPages(profile.role),
  };
});

export async function requireApproved(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved") {
    throw new Error("Your account isn't approved yet.");
  }
  return user;
}

// Management gets every admin-level power: edit targets, edit any branch's
// data, approve accounts, manage the team. Branch PIC gets none of it.
export async function requireManagement(): Promise<CurrentUser> {
  const user = await requireApproved();
  if (user.role !== "Management") {
    throw new Error("Only Management can do this.");
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

// A person can view/switch every branch if they're Management, OR Management
// has explicitly set their individual branch to "All Branches" on the Team
// page — independent of access level.
export function canViewAllBranches(user: CurrentUser): boolean {
  return user.role === "Management" || user.homeBranch === "all";
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
  // Management should land on the combined "All Branches" view by
  // default, not a single branch — only used as a fallback when there's
  // no saved cookie yet (a fresh browser, or right after logging in for
  // the first time); switching branches afterward is still remembered as
  // before.
  const fallback = user.role === "Management" ? "all" : user.homeBranch === "all" ? "kapar" : user.homeBranch;
  return getRawBranchSelection(fallback);
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
