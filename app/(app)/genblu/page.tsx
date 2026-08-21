import { requirePageContext, requirePage, canViewAllBranches, getActiveBranchSelection } from "@/lib/current-user";
import {
  getGenbluRegistrations,
  getAllBranchesGenbluRegistrations,
  getScreenshotUrl,
  getGenbluPointsByName,
} from "@/lib/genblu-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import GenbluClient from "./GenbluClient";

export const dynamic = "force-dynamic";

export default async function GenbluPage() {
  await requirePage("genblu");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";

  const [registrations, mechanics, pointsByName] = await Promise.all([
    showAllBranches ? getAllBranchesGenbluRegistrations() : getGenbluRegistrations(branch),
    getAllMechanics(),
    getGenbluPointsByName(),
  ]);
  const withUrls = await Promise.all(
    registrations.map(async (r) => ({
      ...r,
      screenshotUrl: r.screenshotPath ? await getScreenshotUrl(r.screenshotPath) : null,
      // The real GenBlu balance read off the screenshot wins when we have
      // it — it's the actual number, not our own RM-spent estimate.
      points: r.pointsAccrued ?? pointsByName[r.customerName.trim().toLowerCase()] ?? 0,
      pointsAreActual: r.pointsAccrued !== null,
    }))
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="GenBlu Tracker"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${registrations.length} registered`}
      />
      <div className="p-8">
        <GenbluClient
          registrations={withUrls}
          mechanics={mechanics}
          branch={branch}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
        />
      </div>
    </div>
  );
}
