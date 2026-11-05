import Link from "next/link";
import { ClipboardList, Wallet, Layers, PackageCheck, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency, monthLabel, MONTH_NAMES } from "@/lib/format";
import { todayInMalaysia } from "@/lib/malaysia-time";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import StatCard from "@/components/StatCard";
import CountUp from "@/components/CountUp";
import CombinedTargetEditor from "./CombinedTargetEditor";
import BranchBreakdownTable, { getBranchBreakdown, getAllBranchesAchievedTotal } from "./BranchBreakdownTable";
import MonthlyTrends from "./MonthlyTrends";
import { getSuspiciousWalkInJobs } from "@/lib/repairs-actions";
import { getBranchMonthSummary, getBranchPerformance } from "@/lib/reports-actions";
import { getMonthlyTrends } from "@/lib/trends-actions";
import { getRevenuePace } from "@/lib/revenue-pace-actions";
import RevenuePace from "./RevenuePace";
import MonthlyPaceChart from "./MonthlyPaceChart";
import {
  getWarrantyClaimStatusBreakdown,
  getDeliveryClaimStatusBreakdown,
  getPackageSalesBreakdown,
  getTodayActivity,
} from "@/lib/dashboard-breakdowns-actions";
import { getMechanicCommitment } from "@/lib/mechanic-commitment-actions";
import TodaysJobCheck from "./TodaysJobCheck";
import PackageBreakdownCharts from "./PackageBreakdownCharts";
import ClaimStatusPieCard from "./ClaimStatusPieCard";
import BranchMechanicLeaderboard from "./BranchMechanicLeaderboard";
import SuspiciousJobsBanner from "./SuspiciousJobsBanner";

// Circular "% of target" gauge for the dashboard banner. Fills up on page
// load (ring-fill keyframes in globals.css); the number can go past 100%.
function ProgressRing({ pct }: { pct: number }) {
  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, pct) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-neutral-100" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={`animate-ring-fill ${pct >= 100 ? "stroke-emerald-500" : "stroke-red-600"}`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ "--ring-c": `${c}px` } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={pct} kind="percent" className="text-3xl font-bold tabular-nums text-neutral-900" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mt-0.5">of target</span>
      </div>
    </div>
  );
}

// Heading that groups the dashboard into Today / This Month / Trends / Team,
// so it reads top to bottom instead of as one long stack of cards.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

// Rolls (year, month) back one month, correctly crossing a year boundary.
function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export default async function AllBranchesOverview({
  year,
  month,
  day,
  isManagement,
  showSuspiciousJobs,
  branchSelection,
}: {
  year: number;
  month: number;
  day: number;
  isManagement: boolean;
  showSuspiciousJobs: boolean;
  branchSelection: BranchSelection;
}) {
  const prev = previousMonth(year, month);
  const selectedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // "all" shows the company-wide combined view (unchanged); picking a
  // specific branch in the switcher scopes every section on this page down
  // to just that branch instead.
  const onlyBranch = branchSelection === "all" ? undefined : branchSelection;

  // Fetched together (rather than each as its own async Server Component
  // further down the tree) so they run as one wave of parallel queries
  // instead of three sequential waterfalls — this was the main source of
  // dashboard lag before.
  const [
    rows,
    suspiciousJobs,
    prevAchieved,
    trendPoints,
    revenuePace,
    claimStatusBreakdown,
    deliveryClaimStatusBreakdown,
    packageBreakdown,
    mechanicCommitment,
    todayActivity,
    branchMechanicRows,
  ] = await Promise.all([
    getBranchBreakdown(year, month),
    showSuspiciousJobs ? getSuspiciousWalkInJobs(onlyBranch) : Promise.resolve([]),
    onlyBranch
      ? getBranchMonthSummary(onlyBranch, prev.year, prev.month).then((s) => s.achievedAmount)
      : getAllBranchesAchievedTotal(prev.year, prev.month),
    getMonthlyTrends(year, month, 6, onlyBranch),
    getRevenuePace(year, month, onlyBranch, day),
    getWarrantyClaimStatusBreakdown(year, month, onlyBranch),
    getDeliveryClaimStatusBreakdown(year, month, onlyBranch),
    getPackageSalesBreakdown(year, month),
    isManagement
      ? getMechanicCommitment(onlyBranch)
      : Promise.resolve({ date: "", dailyTargetByBranch: {} as Record<Branch, number>, rows: [] }),
    getTodayActivity(onlyBranch, selectedDate),
    onlyBranch ? getBranchPerformance(onlyBranch, year, month) : Promise.resolve([]),
  ]);

  // Combined view sums every branch's row; single-branch view just reads
  // that one branch's own row instead of summing.
  const totals = onlyBranch
    ? (() => {
        const row = rows.find((r) => r.branch === onlyBranch);
        return { target: row?.target ?? 0, achieved: row?.achieved ?? 0, approvedClaims: row?.approvedClaims ?? 0 };
      })()
    : rows.reduce(
        (acc, b) => ({
          target: acc.target + b.target,
          achieved: acc.achieved + b.achieved,
          approvedClaims: acc.approvedClaims + b.approvedClaims,
        }),
        { target: 0, achieved: 0, approvedClaims: 0 }
      );
  const pct = totals.target > 0 ? Math.min(100, Math.floor((totals.achieved / totals.target) * 100)) : 0;
  // Working days (Mon–Sat; branches are closed Sundays) left this month,
  // counting today — only for the current month.
  const workingDaysLeft = (() => {
    const [ty, tm, td] = todayInMalaysia().split("-").map(Number);
    if (ty !== year || tm !== month) return 0;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    let n = 0;
    for (let d = td; d <= last; d++) if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() !== 0) n++;
    return n;
  })();

  const serviceRevenueToday = revenuePace.branches.reduce((sum, b) => sum + b.revenueToday, 0);
  const dayLabel = `${day} ${MONTH_NAMES[month - 1]} ${year}`;

  // Same achieved-vs-target figures the trend chart above already fetched
  // (one range query per table, covering all 6 months) — reused here
  // instead of running getMonthlyTargetHistory's separate month-by-month,
  // branch-by-branch fetch, which recomputed the exact same numbers via
  // ~50 extra database round-trips.
  const monthlyTargetHistory = trendPoints.map((t) => ({
    year: t.year,
    month: t.month,
    achieved: t.achievedAmount,
    target: t.targetAmount,
  }));

  // Month-over-month change vs the same combined-achieved figure last month.
  // No badge when there's nothing to compare against (e.g. a brand new month).
  const trendPct = prevAchieved > 0 ? Math.round(((totals.achieved - prevAchieved) / prevAchieved) * 100) : null;

  return (
    <div className="space-y-8 stagger">
      {/* Headline number first: this month's target vs achieved. */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-neutral-200 p-6 md:p-8">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-red-600" />
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-700">
              <Layers size={14} aria-hidden="true" />
              <span>
                {onlyBranch ? branchLabel(onlyBranch) : "All Branches"} · {monthLabel(month, year)}
                {onlyBranch ? "" : " · combined"}
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-500">Achieved so far</p>
            <p className="text-4xl md:text-5xl font-bold tracking-tight tabular-nums text-neutral-900">
              <CountUp value={totals.achieved} kind="currency" />
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <p className="text-sm text-neutral-600">
                of <span className="font-semibold text-neutral-900 tabular-nums">{formatCurrency(totals.target)}</span> target
              </p>
              {trendPct !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    trendPct >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {trendPct >= 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
                  {Math.abs(trendPct)}% vs {monthLabel(prev.month, prev.year)}
                </span>
              )}
            </div>

            <div
              className="mt-6 h-2.5 bg-neutral-100 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress to monthly target"
            >
              <div
                className={`h-full rounded-full animate-grow-x ${pct >= 100 ? "bg-emerald-500" : "bg-red-600"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {totals.target > 0 && (
              <p className="mt-3 text-sm font-medium">
                {totals.achieved >= totals.target ? (
                  <span className="text-emerald-700">
                    Target reached — {formatCurrency(totals.achieved - totals.target)} over
                  </span>
                ) : (
                  <span className="text-neutral-900">
                    {formatCurrency(totals.target - totals.achieved)} more to reach the target
                    {workingDaysLeft > 0 && (
                      <span className="text-neutral-500 font-normal">
                        {" "}
                        · about {formatCurrency((totals.target - totals.achieved) / workingDaysLeft)} a day for the{" "}
                        {workingDaysLeft} working day{workingDaysLeft === 1 ? "" : "s"} left
                      </span>
                    )}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex md:flex-col items-center gap-5 md:gap-4">
            <ProgressRing pct={totals.target > 0 ? Math.floor((totals.achieved / totals.target) * 100) : 0} />
            <CombinedTargetEditor
              year={year}
              month={month}
              branchTargets={rows.reduce((acc, b) => ({ ...acc, [b.branch]: b.target }), {} as Record<Branch, number>)}
            />
          </div>
        </div>
      </div>

      {/* Alerts — anything that needs action or a heads-up, most urgent first. */}
      {showSuspiciousJobs && <SuspiciousJobsBanner jobs={suspiciousJobs} showBranch={!onlyBranch} />}

      {isManagement && (
        <TodaysJobCheck rows={mechanicCommitment.rows} />
      )}

      {/* The picked day (today by default), at a glance. */}
      <Section title={revenuePace.isRealToday ? "Today" : dayLabel}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={ClipboardList}
          label={revenuePace.isRealToday ? "Jobsheet Today" : `Jobsheet — ${dayLabel}`}
          value={todayActivity.jobsheetCount}
          color="text-red-700 bg-red-500/10"
          href="/repairs/walk-in"
        />
        <StatCard
          icon={Wallet}
          label={revenuePace.isRealToday ? "Service Revenue Today" : `Service Revenue — ${dayLabel}`}
          value={formatCurrency(serviceRevenueToday)}
          color="text-emerald-700 bg-emerald-500/10"
          href="/repairs/walk-in"
        />
        <StatCard
          icon={PackageCheck}
          label={revenuePace.isRealToday ? "Services Combo Today" : `Services Combo — ${dayLabel}`}
          value={todayActivity.packagesSoldCount}
          detail={`${todayActivity.packagesByType.Yamalube} Yamalube · ${todayActivity.packagesByType["Rock Oil"]} Rock Oil`}
          color="text-teal-700 bg-teal-500/10"
          href="/packages"
        />
      </div>
      </Section>

      <Section title="This Month">
      <RevenuePace
        data={revenuePace}
        title={onlyBranch ? `Revenue Run-Rate — ${branchLabel(onlyBranch)}` : "Revenue Run-Rate — all branches"}
      />

      <MonthlyPaceChart
        points={monthlyTargetHistory}
        workingDaysRemaining={revenuePace.branches[0]?.workingDaysRemaining ?? 0}
        title={onlyBranch ? `Pace to Target — ${branchLabel(onlyBranch)}` : "Pace to Target"}
      />

      {/* Claims and combo sales side by side on wide screens. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
        <ClaimStatusPieCard
          warranty={claimStatusBreakdown}
          delivery={deliveryClaimStatusBreakdown}
          subtitle={onlyBranch ? "This month" : "All branches, this month"}
        />
        <PackageBreakdownCharts packageBreakdown={packageBreakdown} onlyBranch={onlyBranch} />
      </div>
      </Section>

      <Section title="Last 6 Months">
        <MonthlyTrends points={trendPoints} />
      </Section>

      <Section title={onlyBranch ? "Mechanics" : "Branches"}>
        {onlyBranch ? <BranchMechanicLeaderboard rows={branchMechanicRows} /> : <BranchBreakdownTable rows={rows} />}
      </Section>
    </div>
  );
}
