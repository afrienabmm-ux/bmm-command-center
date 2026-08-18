import { requirePageContext, requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getAllBranchesActiveRepairJobs } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { getPackages } from "@/lib/packages-actions";
import { getAllCatalogProducts } from "@/lib/catalog-actions";
import PageHeader from "@/components/PageHeader";
import RepairJobForm from "../RepairJobForm";

export const dynamic = "force-dynamic";

export default async function NewRepairJobPage() {
  await requirePage("repairs");
  const { user } = await requirePageContext();
  const [branchSelection, allActiveJobs, mechanics, packages, catalogProducts] = await Promise.all([
    getActiveBranchSelection(user),
    getAllBranchesActiveRepairJobs(),
    getAllMechanics(),
    getPackages(),
    getAllCatalogProducts(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Add Restore Bike Job" subtitle="Fill in the job details below, then save to return to the list" />
      <div className="p-8">
        <RepairJobForm
          job={null}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
          mechanics={mechanics}
          allActiveJobs={allActiveJobs}
          packages={packages}
          catalogProducts={catalogProducts}
        />
      </div>
    </div>
  );
}
