import { requirePageContext, requirePage, getActiveBranchSelection } from "@/lib/current-user";
import { getActiveRepairJobs, getCompletedRepairJobs, getAllBranchesActiveRepairJobs, getAllBranchesCompletedRepairJobs } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import WalkInClient from "./WalkInClient";

export const dynamic = "force-dynamic";

export default async function WalkInPage() {
  await requirePage("walk-in");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";

  const [allActive, allCompleted, mechanics] = await Promise.all([
    showAllBranches ? getAllBranchesActiveRepairJobs() : getActiveRepairJobs(branch),
    showAllBranches ? getAllBranchesCompletedRepairJobs() : getCompletedRepairJobs(branch),
    getAllMechanics(),
  ]);
  const active = allActive.filter((j) => j.jobType === "Walk-in");
  const completed = allCompleted.filter((j) => j.jobType === "Walk-in");

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Walk-in"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${active.length} active job${active.length === 1 ? "" : "s"}`}
      />
      <div className="p-8">
        <WalkInClient active={active} completed={completed} mechanics={mechanics} branchSelection={branchSelection} />
      </div>
    </div>
  );
}
