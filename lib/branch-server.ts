import "server-only";
import { cookies } from "next/headers";
import { BRANCHES, BRANCH_COOKIE_NAME, type Branch, type BranchSelection } from "./branch";

export async function getSelectedBranch(fallback: Branch): Promise<Branch> {
  const cookieStore = await cookies();
  const value = cookieStore.get(BRANCH_COOKIE_NAME)?.value as Branch | undefined;
  if (value && BRANCHES.some((b) => b.value === value)) return value;
  return fallback;
}

// Raw selection including "all" — only meaningful for pages that know how to
// render every branch at once (Command Center, Reports). Everything else
// should keep using getSelectedBranch, which safely collapses "all" back to
// a single real branch.
export async function getRawBranchSelection(fallback: Branch): Promise<BranchSelection> {
  const cookieStore = await cookies();
  const value = cookieStore.get(BRANCH_COOKIE_NAME)?.value;
  if (value === "all") return "all";
  if (value && BRANCHES.some((b) => b.value === value)) return value as Branch;
  return fallback;
}
