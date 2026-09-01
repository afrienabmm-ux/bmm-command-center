import { requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import {
  getAllBranchesPerformance,
  getBranchPerformance,
  getBranchAchievedInRange,
  type MechanicPerformanceRowWithBranch,
} from "@/lib/reports-actions";
import { getMechanicCommitment } from "@/lib/mechanic-commitment-actions";
import { getMonthlyTarget } from "@/lib/targets-actions";
import {
  todayInMalaysia,
  startOfWeekInMalaysia,
  endOfWeekInMalaysia,
  countWorkingDaysInMonth,
  WORKING_DAYS_PER_WEEK,
} from "@/lib/malaysia-time";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";
import DaySelect from "./DaySelect";
import AllBranchesMechanicPerformanceTable from "../AllBranchesMechanicPerformanceTable";

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

  // The Target card shows this working week's pace, not the whole month's
  // — the week the currently-selected day falls in (Monday–Saturday, 6
  // working days, same week the mechanics' own daily-pace streak uses).
  const weekStart = startOfWeekInMalaysia(selectedDate);
  const weekEnd = endOfWeekInMalaysia(selectedDate);

  const [rows, prevRows, commitment, targetList, weekAchievedList] = await Promise.all([
    onlyBranch
      ? getBranchPerformance(onlyBranch, year, month).then(
          (r): MechanicPerformanceRowWithBranch[] => r.map((row) => ({ ...row, branch: onlyBranch }))
        )
      : getAllBranchesPerformance(year, month),
    onlyBranch ? getBranchPerformance(onlyBranch, prevYear, prevMonth) : getAllBranchesPerformance(prevYear, prevMonth),
    getMechanicCommitment(onlyBranch, selectedDate),
    // Every branch's target is fetched even on a single-branch view, since
    // the table's own branch dropdown re-scopes client-side without a
    // round trip — the matching target has to already be on hand.
    Promise.all(BRANCHES.map(({ value }) => getMonthlyTarget(value, year, month))),
    Promise.all(BRANCHES.map(({ value }) => getBranchAchievedInRange(value, weekStart, weekEnd))),
  ]);

  // A monthly target prorated down to a week by working days (Sundays
  // excluded), not just divided by ~4.3 — matches the same working-day
  // pace the Dashboard's own revenue run-rate chart already uses.
  const workingDaysInMonth = countWorkingDaysInMonth(year, month);
  const targetByBranch = Object.fromEntries(
    BRANCHES.map(({ value }, i) => {
      const monthlyTarget = targetList[i]?.targetAmount ?? 0;
      const weeklyTarget = workingDaysInMonth > 0 ? Math.round((monthlyTarget / workingDaysInMonth) * WORKING_DAYS_PER_WEEK) : 0;
      return [value, weeklyTarget];
    })
  ) as Record<Branch, number>;
  const weekAchievedByBranch = Object.fromEntries(
    BRANCHES.map(({ value }, i) => [value, weekAchievedList[i]])
  ) as Record<Branch, number>;

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
          targetByBranch={targetByBranch}
          weekAchievedByBranch={weekAchievedByBranch}
          selectedDate={selectedDate}
          isToday={selectedDate === todayIso}
        />
      </div>
    </div>
  );
}
