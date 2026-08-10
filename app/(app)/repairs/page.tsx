import { requirePageContext, requirePage } from "@/lib/current-user";
import { getActiveRepairJobs, getCompletedRepairJobs } from "@/lib/repairs-actions";
import { getMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import RepairsClient from "./RepairsClient";

export const dynamic = "force-dynamic";

export default async function RepairsPage() {
  await requirePage("repairs");
  const { branch } = await requirePageContext();
  const [active, completed, mechanics] = await Promise.all([
    getActiveRepairJobs(branch),
    getCompletedRepairJobs(branch),
    getMechanics(branch),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Workshop Repairs"
        subtitle={`${branchLabel(branch)} — ${active.length} active job${active.length === 1 ? "" : "s"}`}
      />
      <div className="p-8">
        <RepairsClient active={active} completed={completed} mechanics={mechanics} branch={branch} />
      </div>
    </div>
  );
}
