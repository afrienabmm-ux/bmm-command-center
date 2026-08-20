import { requirePageContext, requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getWarrantyClaims, getAllBranchesWarrantyClaims } from "@/lib/claims-actions";
import { getDeliveryClaims, getAllBranchesDeliveryClaims } from "@/lib/delivery-claims-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import ClaimsClient from "./ClaimsClient";
import DeliveryClaimsClient from "./DeliveryClaimsClient";
import ClaimsTabs from "./ClaimsTabs";

export const dynamic = "force-dynamic";

export default async function WarrantyClaimsPage() {
  await requirePage("warranty-claims");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";
  const [claims, deliveryClaims] = await Promise.all([
    showAllBranches ? getAllBranchesWarrantyClaims() : getWarrantyClaims(branch),
    showAllBranches ? getAllBranchesDeliveryClaims() : getDeliveryClaims(branch),
  ]);
  const locked = !canViewAllBranches(user);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Claims"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${claims.length} warranty, ${deliveryClaims.length} delivery`}
      />
      <div className="p-8">
        <ClaimsTabs
          warrantyCount={claims.length}
          deliveryCount={deliveryClaims.length}
          warranty={<ClaimsClient claims={claims} branchSelection={branchSelection} locked={locked} />}
          delivery={<DeliveryClaimsClient claims={deliveryClaims} branchSelection={branchSelection} locked={locked} />}
        />
      </div>
    </div>
  );
}
