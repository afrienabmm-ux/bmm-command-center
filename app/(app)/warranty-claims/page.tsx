import { requirePageContext, requirePage } from "@/lib/current-user";
import { getWarrantyClaims } from "@/lib/claims-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import ClaimsClient from "./ClaimsClient";

export const dynamic = "force-dynamic";

export default async function WarrantyClaimsPage() {
  await requirePage("warranty-claims");
  const { branch } = await requirePageContext();
  const claims = await getWarrantyClaims(branch);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Warranty Claims" subtitle={`${branchLabel(branch)} — ${claims.length} claims on record`} />
      <div className="p-8">
        <ClaimsClient claims={claims} branch={branch} />
      </div>
    </div>
  );
}
