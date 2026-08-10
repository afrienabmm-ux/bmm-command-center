"use server";

import { cookies } from "next/headers";
import { BRANCH_COOKIE_NAME, type BranchSelection } from "./branch";

export async function setBranchAction(branch: BranchSelection): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(BRANCH_COOKIE_NAME, branch, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
