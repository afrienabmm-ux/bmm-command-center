import { requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getAllBranchesPerformance, getBranchPerformance, type MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import { getPackageSalesBreakdown } from "@/lib/dashboard-breakdowns-actions";
import { getMechanicCommitment } from "@/lib/mechanic-commitment-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";
import DaySelect from "./DaySelect";
import AllBranchesMechanicPerformanceTable from "../AllBranchesMechanicPerformanceTable";
import PackageBreakdownCharts from "../PackageBreakdownCharts";

export const dynamic = "force-dynamic";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default async function SalesPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; day?: string }>;
}) {
  const user = await requirePage("sales-performance");
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  // The GM wants to review a past day's pace, not just today's — the Day
  // selector below picks any day within the selected month. Defaults to
  // today's date when the current month is selected, otherwise the 1st.
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const defaultDay = isCurrentMonth ? now.getDate() : 1;
  const day = Math.min(params.day ? Number(params.day) : defaultDay, daysInMonth);
  const selectedDate = `${year}-${pad(month)}-${pad(day)}`;
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const branchSelection = await getActiveBranchSelection(user);
  const locked = !canViewAllBranches(user);
  const onlyBranch = branchSelection === "all" ? undefined : branchSelection;

  // Rolls (year, month) back one month, correctly crossing a year boundary
  // — same previous-month comparison the Dashboard's target banner uses.
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const [rows, prevRows, packageBreakdown, commitment] = await Promise.all([
    onlyBranch
      ? getBranchPerformance(onlyBranch, year, month).then(
          (r): MechanicPerformanceRowWithBranch[] => r.map((row) => ({ ...row, branch: onlyBranch }))
        )
      : getAllBranchesPerformance(year, month),
    onlyBranch ? getBranchPerformance(onlyBranch, prevYear, prevMonth) : getAllBranchesPerformance(prevYear, prevMonth),
    getPackageSalesBreakdown(year, month),
    getMechanicCommitment(onlyBranch, selectedDate),
  ]);

  // Plain objects, not Maps — Map instances can't cross the Server/Client
  // Component boundary as props.
  const prevRevenueByMechanicId: Record<string, number> = Object.fromEntries(
    prevRows.map((r) => [r.mechanicId, r.totalRevenue])
  );
  const commitmentByMechanicId = Object.fromEntries(commitment.rows.map((r) => [r.mechanicId, r]));

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Sales Performance"
        subtitle={onlyBranch ? `Every mechanic's revenue and packages — ${branchLabel(onlyBranch)}` : "Every mechanic's revenue and packages, all branches"}
        action={
          <div className="flex items-center gap-2">
            <DaySelect year={year} month={month} day={day} />
            <MonthPicker year={year} month={month} basePath="/sales-performance" />
          </div>
        }
      />
      <div className="p-8 space-y-8">
        <AllBranchesMechanicPerformanceTable
          rows={rows}
          branchSelection={branchSelection}
          locked={locked}
          prevRevenueByMechanicId={prevRevenueByMechanicId}
          commitmentByMechanicId={commitmentByMechanicId}
          dailyTarget={commitment.revenueTarget}
          selectedDate={selectedDate}
          isToday={selectedDate === todayIso}
        />
        <PackageBreakdownCharts packageBreakdown={packageBreakdown} onlyBranch={onlyBranch} />
      </div>
    </div>
  );
}
