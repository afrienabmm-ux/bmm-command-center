import { requirePageContext, requirePage, getActiveBranchSelection } from "@/lib/current-user";
import {
  getActiveRepairJobs,
  getQcRepairJobs,
  getCompletedRepairJobs,
  getAllBranchesActiveRepairJobs,
  getAllBranchesQcRepairJobs,
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

  const [allActive, allQc, allCompleted, mechanics] = await Promise.all([
    showAllBranches ? getAllBranchesActiveRepairJobs() : getActiveRepairJobs(branch),
    showAllBranches ? getAllBranchesQcRepairJobs() : getQcRepairJobs(branch),
    showAllBranches ? getAllBranchesCompletedRepairJobs() : getCompletedRepairJobs(branch),
    getAllMechanics(),
  ]);
  const active = allActive.filter((j) => j.jobType === "Restore Bike");
  const qc = allQc.filter((j) => j.jobType === "Restore Bike");
  const completed = allCompleted.filter((j) => j.jobType === "Restore Bike");

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Restore Bike"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${active.length} active job${active.length === 1 ? "" : "s"}`}
      />
      <div className="p-8">
        <RepairsClient
          active={active}
          qc={qc}
          completed={completed}
          mechanics={mechanics}
          branchSelection={branchSelection}
          isManagement={user.role === "Management"}
        />
      </div>
    </div>
  );
}
