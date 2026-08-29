import { requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getAllBranchesPerformance, getBranchPerformance, type MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import { getPackageSalesBreakdown } from "@/lib/dashboard-breakdowns-actions";
import { getMechanicCommitment } from "@/lib/mechanic-commitment-actions";
import { getMonthlyTarget } from "@/lib/targets-actions";
import { todayInMalaysia } from "@/lib/malaysia-time";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { formatCurrency } from "@/lib/format";
import { Target, BarChart3 } from "lucide-react";
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
  // The server's own clock can be in any timezone (Vercel runs UTC, a dev
  // machine might not) — todayInMalaysia() gives the date the business
  // actually experiences right now, so "today" here always matches what
  // MonthPicker/DaySelect compute in the user's own (Malaysia) browser.
  const todayIso = todayInMalaysia();
  const [todayYear, todayMonth, todayDay] = todayIso.split("-").map(Number);
  const year = params.year ? Number(params.year) : todayYear;
  const month = params.month ? Number(params.month) : todayMonth;

  // The GM wants to review a past day's pace, not just today's — the Day
  // selector below picks any day within the selected month. Defaults to
  // today's date when the current month is selected, otherwise the 1st.
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = year === todayYear && month === todayMonth;
  const defaultDay = isCurrentMonth ? todayDay : 1;
  const day = Math.min(params.day ? Number(params.day) : defaultDay, daysInMonth);
  const selectedDate = `${year}-${pad(month)}-${pad(day)}`;

  const branchSelection = await getActiveBranchSelection(user);
  const locked = !canViewAllBranches(user);
  const onlyBranch = branchSelection === "all" ? undefined : branchSelection;

  // Rolls (year, month) back one month, correctly crossing a year boundary
  // — same previous-month comparison the Dashboard's target banner uses.
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const [rows, prevRows, packageBreakdown, commitment, targetList] = await Promise.all([
    onlyBranch
      ? getBranchPerformance(onlyBranch, year, month).then(
          (r): MechanicPerformanceRowWithBranch[] => r.map((row) => ({ ...row, branch: onlyBranch }))
        )
      : getAllBranchesPerformance(year, month),
    onlyBranch ? getBranchPerformance(onlyBranch, prevYear, prevMonth) : getAllBranchesPerformance(prevYear, prevMonth),
    getPackageSalesBreakdown(year, month),
    getMechanicCommitment(onlyBranch, selectedDate),
    // Every branch's target is fetched even on a single-branch view, since
    // the table's own branch dropdown re-scopes client-side without a
    // round trip — the matching target has to already be on hand.
    Promise.all(BRANCHES.map(({ value }) => getMonthlyTarget(value, year, month))),
  ]);

  const targetByBranch = Object.fromEntries(
    BRANCHES.map(({ value }, i) => [value, targetList[i]?.targetAmount ?? 0])
  ) as Record<Branch, number>;

  // Plain objects, not Maps — Map instances can't cross the Server/Client
  // Component boundary as props.
  const prevRevenueByMechanicId: Record<string, number> = Object.fromEntries(
    prevRows.map((r) => [r.mechanicId, r.totalRevenue])
  );
  const commitmentByMechanicId = Object.fromEntries(commitment.rows.map((r) => [r.mechanicId, r]));

  // Target and achieved are both scoped to whatever branch(es) the page is
  // currently showing — "all branches" sums every branch's own target, a
  // single branch just reads its own.
  const totalTargetAmount = onlyBranch
    ? targetByBranch[onlyBranch]
    : BRANCHES.reduce((sum, b) => sum + targetByBranch[b.value], 0);
  const achievedAmount = rows.reduce((sum, r) => sum + r.totalRevenue, 0);
  const targetPct = totalTargetAmount > 0 ? Math.round((achievedAmount / totalTargetAmount) * 100) : 0;

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
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500">Target</p>
              <Target size={16} className="text-red-500" />
            </div>
            <p className="text-2xl font-semibold text-neutral-900 mt-1">{formatCurrency(totalTargetAmount)}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{onlyBranch ? branchLabel(onlyBranch) : "all branches"}</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500">% of Target</p>
              <BarChart3 size={16} className="text-indigo-500" />
            </div>
            <p className="text-2xl font-semibold text-neutral-900 mt-1">{targetPct}%</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {formatCurrency(achievedAmount)} / {formatCurrency(totalTargetAmount)}
            </p>
          </div>
        </div>
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
