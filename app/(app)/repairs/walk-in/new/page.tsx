import { requirePageContext, requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getAllBranchesActiveRepairJobs } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import PageHeader from "@/components/PageHeader";
import WalkInJobForm from "../WalkInJobForm";

export const dynamic = "force-dynamic";
// The GenBlu screenshot check runs an OCR call (with retries) inside this
// page's server actions — give it more room than the platform default so a
// slow Vision API response doesn't time out mid-save.
export const maxDuration = 60;

export default async function NewWalkInJobPage() {
  await requirePage("walk-in");
  const { user } = await requirePageContext();
  const [branchSelection, allActiveJobs, mechanics] = await Promise.all([
    getActiveBranchSelection(user),
    getAllBranchesActiveRepairJobs(),
    getAllMechanics(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Add Walk-in Job" subtitle="Fill in the job details below, then save to return to the list" />
      <div className="p-8">
        <WalkInJobForm
          job={null}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
          mechanics={mechanics}
          allActiveJobs={allActiveJobs}
        />
      </div>
    </div>
  );
}
