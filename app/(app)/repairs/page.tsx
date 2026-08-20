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
import ArrivalListingClient from "./ArrivalListingClient";
import RestoreBikeTabs from "./RestoreBikeTabs";

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
  const activeRestoreBike = allActive.filter((j) => j.jobType === "Restore Bike");
  // Arrived-but-unassigned bikes live in their own Arrival Listing tab now;
  // Bikes Listing's Active tab only ever shows bikes already handed to a
  // mechanic.
  const arrival = activeRestoreBike.filter((j) => !j.mechanicId);
  const active = activeRestoreBike.filter((j) => j.mechanicId);
  const qc = allQc.filter((j) => j.jobType === "Restore Bike");
  const completed = allCompleted.filter((j) => j.jobType === "Restore Bike");

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Restore Bike"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${arrival.length} waiting to be assigned, ${active.length} active`}
      />
      <div className="p-8">
        <RestoreBikeTabs
          arrivalCount={arrival.length}
          bikesCount={active.length + qc.length + completed.length}
          arrival={
            <ArrivalListingClient jobs={arrival} mechanics={mechanics} branchSelection={branchSelection} allActiveJobs={allActive} />
          }
          bikes={
            <RepairsClient
              active={active}
              qc={qc}
              completed={completed}
              mechanics={mechanics}
              branchSelection={branchSelection}
              isManagement={user.role === "Management"}
            />
          }
        />
      </div>
    </div>
  );
}
