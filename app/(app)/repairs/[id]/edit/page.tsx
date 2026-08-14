import { notFound } from "next/navigation";
import { requirePageContext, requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getRepairJobById, getAllBranchesActiveRepairJobs } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { getPackages } from "@/lib/packages-actions";
import PageHeader from "@/components/PageHeader";
import RepairJobForm from "../../RepairJobForm";

export const dynamic = "force-dynamic";

export default async function EditRepairJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("repairs");
  const { id } = await params;
  const { user } = await requirePageContext();
  const [job, branchSelection, allActiveJobs, mechanics, packages] = await Promise.all([
    getRepairJobById(id),
    getActiveBranchSelection(user),
    getAllBranchesActiveRepairJobs(),
    getAllMechanics(),
    getPackages(),
  ]);

  if (!job) notFound();

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Edit Restore Bike Job" subtitle={`${job.jobNo} — ${job.plateNo}`} />
      <div className="p-8">
        <RepairJobForm
          job={job}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
          mechanics={mechanics}
          allActiveJobs={allActiveJobs}
          packages={packages}
        />
      </div>
    </div>
  );
}
