import { requirePageContext, requirePage, canViewAllBranches, getActiveBranchSelection } from "@/lib/current-user";
import {
  getGenbluRegistrations,
  getAllBranchesGenbluRegistrations,
  getScreenshotUrl,
  getGenbluPointsByName,
  getGenbluMonthlySummary,
  getGenbluTransactions,
  getAllBranchesGenbluTransactions,
} from "@/lib/genblu-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";
import GenbluClient from "./GenbluClient";
import GenbluMonthlySummary from "./GenbluMonthlySummary";
import GenbluTransactionsList from "./GenbluTransactionsList";
import GenbluTabs from "./GenbluTabs";

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

  const [registrations, mechanics, pointsByName, monthlySummary, allTransactions] = await Promise.all([
    showAllBranches ? getAllBranchesGenbluRegistrations() : getGenbluRegistrations(branch),
    getAllMechanics(),
    getGenbluPointsByName(),
    getGenbluMonthlySummary(year, month),
    showAllBranches ? getAllBranchesGenbluTransactions() : getGenbluTransactions(branch),
  ]);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const transactions = allTransactions.filter((t) => (t.transactionDate ?? "").startsWith(monthPrefix));
  const transactionsWithUrls = await Promise.all(
    transactions.map(async (t) => ({
      ...t,
      screenshotUrl: t.screenshotPath ? await getScreenshotUrl(t.screenshotPath) : null,
    }))
  );
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
        title="GenBlu"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${registrations.length} registered, ${transactions.length} allocations this month`}
      />
      <div className="p-8">
        <GenbluTabs
          registeredCount={registrations.length}
          allocationCount={transactions.length}
          tracker={
            <GenbluClient
              registrations={withUrls}
              mechanics={mechanics}
              branch={branch}
              branchSelection={branchSelection}
              locked={!canViewAllBranches(user)}
            />
          }
          allocations={
            <div className="space-y-8">
              <div className="flex justify-end">
                <MonthPicker year={year} month={month} basePath="/genblu" />
              </div>
              <GenbluMonthlySummary summary={monthlySummary} />
              <GenbluTransactionsList transactions={transactionsWithUrls} showBranch={showAllBranches} />
            </div>
          }
        />
      </div>
    </div>
  );
}
