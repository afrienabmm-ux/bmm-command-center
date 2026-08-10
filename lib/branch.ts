export type Branch = "kapar" | "setia_alam" | "puncak_alam";

// A Manager can look at every branch at once — pages that support that
// combined view accept this wider type, everything else stays on one Branch.
export type BranchSelection = Branch | "all";

export const BRANCHES: { value: Branch; label: string }[] = [
  { value: "kapar", label: "Kapar (HQ)" },
  { value: "setia_alam", label: "Setia Alam" },
  { value: "puncak_alam", label: "Puncak Alam" },
];

export function branchLabel(branch: Branch): string {
  return BRANCHES.find((b) => b.value === branch)?.label ?? branch;
}

export const BRANCH_COOKIE_NAME = "cc_branch";
