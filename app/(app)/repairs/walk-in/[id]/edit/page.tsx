import { notFound } from "next/navigation";
import { requirePageContext, requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getRepairJobById, getAllBranchesActiveRepairJobs } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import PageHeader from "@/components/PageHeader";
import WalkInJobForm from "../../WalkInJobForm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function EditWalkInJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("walk-in");
  const { id } = await params;
  const { user } = await requirePageContext();
  const [job, branchSelection, allActiveJobs, mechanics] = await Promise.all([
    getRepairJobById(id),
    getActiveBranchSelection(user),
    getAllBranchesActiveRepairJobs(),
    getAllMechanics(),
  ]);

  if (!job) notFound();

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Edit Walk-in Job" subtitle={`${job.jobNo} — ${job.plateNo}`} />
      <div className="p-8">
        <WalkInJobForm
          job={job}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
          mechanics={mechanics}
          allActiveJobs={allActiveJobs}
        />
      </div>
    </div>
  );
}
