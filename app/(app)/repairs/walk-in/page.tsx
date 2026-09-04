import { requirePageContext, requirePage, getActiveBranchSelection, isManagementLevel } from "@/lib/current-user";
import { getActiveRepairJobs, getCompletedRepairJobs, getAllBranchesActiveRepairJobs, getAllBranchesCompletedRepairJobs } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import WalkInClient from "./WalkInClient";

export const dynamic = "force-dynamic";

export default async function WalkInPage({ searchParams }: { searchParams: Promise<{ highlight?: string }> }) {
  await requirePage("walk-in");
  const { highlight } = await searchParams;
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";

  const [allActive, allCompleted, mechanics] = await Promise.all([
    showAllBranches ? getAllBranchesActiveRepairJobs() : getActiveRepairJobs(branch),
    showAllBranches ? getAllBranchesCompletedRepairJobs() : getCompletedRepairJobs(branch),
    getAllMechanics(),
  ]);
  const walkInActive = allActive.filter((j) => j.jobType === "Walk-in");
  const walkInCompleted = allCompleted.filter((j) => j.jobType === "Walk-in");

  // A job whose scan found no signature, saved anyway, goes to the Errors
  // tab instead of sitting quietly in Active/Completed — pulled out of
  // both here so it only ever shows in one place at a time.
  const isSignatureError = (j: (typeof walkInActive)[number]) => j.signatureStatus === "not_detected" && !j.signatureIssueResolved;
  const active = walkInActive.filter((j) => !isSignatureError(j));
  const completed = walkInCompleted.filter((j) => !isSignatureError(j));
  const errors = [...walkInActive, ...walkInCompleted].filter(isSignatureError);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Jobsheet"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${active.length} active job${active.length === 1 ? "" : "s"}`}
      />
      <div className="p-8">
        <WalkInClient
          active={active}
          completed={completed}
          errors={errors}
          mechanics={mechanics}
          branchSelection={branchSelection}
          highlightId={highlight}
          canEdit
          canResolveErrors={isManagementLevel(user.role)}
        />
      </div>
    </div>
  );
}
