import { requirePageContext, requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getActiveRepairJobs, getCompletedRepairJobs } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import RepairsClient from "./RepairsClient";

export const dynamic = "force-dynamic";

export default async function RepairsPage() {
  await requirePage("repairs");
  const { user, branch } = await requirePageContext();
  const [active, completed, mechanics, branchSelection] = await Promise.all([
    getActiveRepairJobs(branch),
    getCompletedRepairJobs(branch),
    getAllMechanics(),
    getActiveBranchSelection(user),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Workshop Repairs"
        subtitle={`${branchLabel(branch)} — ${active.length} active job${active.length === 1 ? "" : "s"}`}
      />
      <div className="p-8">
        <RepairsClient
          active={active}
          completed={completed}
          mechanics={mechanics}
          branch={branch}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
        />
      </div>
    </div>
  );
}
