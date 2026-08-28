import { requirePageContext, requirePage, getActiveBranchSelection, isManagementLevel } from "@/lib/current-user";
import {
  getPackages,
  getPackageSales,
  getPackageSoldCounts,
  getAllBranchesPackageSales,
  getAllBranchesPackageSoldCounts,
} from "@/lib/packages-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import PackagesClient from "./PackagesClient";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  await requirePage("packages");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";

  const [packages, sales, soldCounts] = await Promise.all([
    getPackages(),
    showAllBranches ? getAllBranchesPackageSales() : getPackageSales(branch),
    showAllBranches ? getAllBranchesPackageSoldCounts() : getPackageSoldCounts(branch),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Services Combo"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — service combo packages`}
      />
      <div className="p-8 space-y-8">
        <PackagesClient
          packages={packages}
          sales={sales}
          soldCounts={soldCounts}
          branch={branch}
          branchSelection={branchSelection}
          isAdmin={isManagementLevel(user.role)}
        />
      </div>
    </div>
  );
}
