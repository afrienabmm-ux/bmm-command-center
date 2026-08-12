import { requirePageContext, requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getWarrantyClaims, getAllBranchesWarrantyClaims } from "@/lib/claims-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import ClaimsClient from "./ClaimsClient";

export const dynamic = "force-dynamic";

export default async function WarrantyClaimsPage() {
  await requirePage("warranty-claims");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";
  const claims = showAllBranches ? await getAllBranchesWarrantyClaims() : await getWarrantyClaims(branch);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Warranty Claims"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${claims.length} claims on record`}
      />
      <div className="p-8">
        <ClaimsClient
          claims={claims}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
        />
      </div>
    </div>
  );
}
