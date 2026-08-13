import { requirePageContext, requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import {
  getActiveRepairJobs,
  getCompletedRepairJobs,
  getAllBranchesActiveRepairJobs,
  getAllBranchesCompletedRepairJobs,
} from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import RepairsClient from "./RepairsClient";

export const dynamic = "force-dynamic";

export default async function RepairsPage() {
  await requirePage("repairs");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";

  const [active, completed, allActiveJobs, mechanics] = await Promise.all([
    showAllBranches ? getAllBranchesActiveRepairJobs() : getActiveRepairJobs(branch),
    showAllBranches ? getAllBranchesCompletedRepairJobs() : getCompletedRepairJobs(branch),
    getAllBranchesActiveRepairJobs(),
    getAllMechanics(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Restore Bike"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${active.length} active job${active.length === 1 ? "" : "s"}`}
      />
      <div className="p-8">
        <RepairsClient
          active={active}
          completed={completed}
          allActiveJobs={allActiveJobs}
          mechanics={mechanics}
          branch={branch}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
        />
      </div>
    </div>
  );
}
