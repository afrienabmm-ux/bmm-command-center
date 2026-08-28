import { requirePageContext, requirePage, canViewAllBranches, getActiveBranchSelection } from "@/lib/current-user";
import {
  getGenbluRegistrations,
  getAllBranchesGenbluRegistrations,
  getScreenshotUrl,
  getGenbluPointsByName,
  getGenbluMonthlySummary,
} from "@/lib/genblu-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";
import GenbluClient from "./GenbluClient";
import GenbluMonthlySummary from "./GenbluMonthlySummary";

export const dynamic = "force-dynamic";

export default async function GenbluPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requirePage("genblu");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const [registrations, mechanics, pointsByName, monthlySummary] = await Promise.all([
    showAllBranches ? getAllBranchesGenbluRegistrations() : getGenbluRegistrations(branch),
    getAllMechanics(),
    getGenbluPointsByName(),
    getGenbluMonthlySummary(year, month),
  ]);
  const withUrls = await Promise.all(
    registrations.map(async (r) => ({
      ...r,
      screenshotUrl: r.screenshotPath ? await getScreenshotUrl(r.screenshotPath) : null,
      // The running total built from actual "proof of award" screenshots
      // wins when there's at least one — real points the admin gave this
      // customer, not our own RM-spent estimate.
      points: r.pointsAccrued ?? pointsByName[r.customerName.trim().toLowerCase()] ?? 0,
      pointsAreActual: r.pointsAccrued !== null,
    }))
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="GenBlu Tracker"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${registrations.length} registered`}
        action={<MonthPicker year={year} month={month} basePath="/genblu" />}
      />
      <div className="p-8 space-y-8">
        <GenbluMonthlySummary summary={monthlySummary} />
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
