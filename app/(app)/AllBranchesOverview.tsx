import Link from "next/link";
import { ClipboardList, Wallet, PackageCheck } from "lucide-react";
import { formatCurrency, monthLabel, MONTH_NAMES } from "@/lib/format";
import { todayInMalaysia } from "@/lib/malaysia-time";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import StatCard from "@/components/StatCard";
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

// Month-target dial, drawn like a bike's speedometer: the red sweep is how
// much of the target is done, and the dark tick is where we should be by
// today if we were exactly on pace. The number can go past 100%.
function TargetDial({ pct, expectedPct }: { pct: number; expectedPct: number | null }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 88;
  const START = 150; // degrees, clockwise from 3 o'clock
  const SWEEP = 240;
  const at = (fraction: number, radius: number) => {
    const a = ((START + SWEEP * Math.max(0, Math.min(1, fraction))) * Math.PI) / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const;
  };
  const arc = (to: number) => {
    const [x0, y0] = at(0, r);
    const [x1, y1] = at(to, r);
    return `M${x0},${y0} A${r},${r} 0 ${SWEEP * to > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  const done = Math.min(100, pct) / 100;
  const reached = pct >= 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: 184 }}>
      <svg width={size} height={184} aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => {
          const major = i % 5 === 0;
          const [x0, y0] = at(i / 10, r - 14);
          const [x1, y1] = at(i / 10, r - (major ? 22 : 18));
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={1.5} strokeLinecap="round" className="stroke-neutral-300" />;
        })}
        <path d={arc(1)} fill="none" strokeWidth={10} strokeLinecap="round" className="stroke-neutral-100" />
        {done > 0 && (
          <path d={arc(done)} fill="none" strokeWidth={10} strokeLinecap="round" className={reached ? "stroke-emerald-600" : "stroke-red-600"} />
        )}
        {expectedPct !== null && expectedPct > 0 && (
          (() => {
            const [x0, y0] = at(Math.min(100, expectedPct) / 100, r - 11);
            const [x1, y1] = at(Math.min(100, expectedPct) / 100, r + 11);
            return <line x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={3} strokeLinecap="round" className="stroke-neutral-900" />;
          })()
        )}
      </svg>
      <div className="absolute inset-x-0 top-[72px] flex flex-col items-center">
        <span className="text-4xl font-semibold tracking-tight tabular-nums text-neutral-900">{pct}%</span>
        <span className="text-xs text-neutral-500 mt-1">of target</span>
      </div>
      {expectedPct !== null && (
        <p className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
          <span aria-hidden="true" className="inline-block w-0.5 h-3 rounded-full bg-neutral-900" />
          Should be {Math.min(100, expectedPct)}% by today
        </p>
      )}
    </div>
  );
}

// Heading that groups the dashboard into Today / This Month / Trends / Team,
// so it reads top to bottom instead of as one long stack of cards.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
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

  // Where the month should be by today if every working day were on pace —
  // the same marker the branch cards use, summed across branches.
  const expectedByToday = revenuePace.branches.reduce((sum, b) => sum + b.expectedByToday, 0);
  const expectedPct = totals.target > 0 ? Math.round((expectedByToday / totals.target) * 100) : null;
  const pctRaw = totals.target > 0 ? Math.floor((totals.achieved / totals.target) * 100) : 0;

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
    <div className="space-y-8 enter">
      {/* Headline number first: this month's target vs achieved. */}
      <div className="rounded-xl bg-white border border-neutral-200 p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <p className="text-sm text-neutral-500">
              {onlyBranch ? branchLabel(onlyBranch) : "All branches"} · {monthLabel(month, year)}
            </p>
            <p className="mt-2 text-sm text-neutral-600">Achieved so far</p>
            <p className="text-4xl md:text-5xl font-semibold tracking-tight tabular-nums text-neutral-900">{formatCurrency(totals.achieved)}</p>
            <p className="mt-2 text-sm text-neutral-600">
              of <span className="font-medium text-neutral-900 tabular-nums">{formatCurrency(totals.target)}</span> target
              {trendPct !== null && (
                <>
                  {" · "}
                  <span className={trendPct >= 0 ? "text-emerald-700" : "text-red-700"}>
                    {Math.abs(trendPct)}% {trendPct >= 0 ? "more" : "less"} than {monthLabel(prev.month, prev.year)}
                  </span>
                </>
              )}
            </p>
            {totals.target > 0 && (
              <p className="mt-6 text-sm">
                {totals.achieved >= totals.target ? (
                  <span className="text-emerald-700">Target reached, {formatCurrency(totals.achieved - totals.target)} over</span>
                ) : (
                  <span className="text-neutral-900">
                    <span className="tabular-nums">{formatCurrency(totals.target - totals.achieved)}</span> more to reach the target
                    {workingDaysLeft > 0 && (
                      <span className="text-neutral-500">
                        {" "}
                        · about <span className="tabular-nums">{formatCurrency((totals.target - totals.achieved) / workingDaysLeft)}</span> a day for
                        the {workingDaysLeft} working day{workingDaysLeft === 1 ? "" : "s"} left
                      </span>
                    )}
                  </span>
                )}
              </p>
            )}
            <div className="mt-4">
              <CombinedTargetEditor
                year={year}
                month={month}
                branchTargets={rows.reduce((acc, b) => ({ ...acc, [b.branch]: b.target }), {} as Record<Branch, number>)}
              />
            </div>
          </div>

          <TargetDial pct={pctRaw} expectedPct={revenuePace.isRealToday ? expectedPct : null} />
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
          label={revenuePace.isRealToday ? "Jobsheets today" : `Jobsheets, ${dayLabel}`}
          value={todayActivity.jobsheetCount}
          color="text-red-700 bg-red-500/10"
          href="/repairs/walk-in"
        />
        <StatCard
          icon={Wallet}
          label={revenuePace.isRealToday ? "Service revenue today" : `Service revenue, ${dayLabel}`}
          value={formatCurrency(serviceRevenueToday)}
          color="text-emerald-700 bg-emerald-500/10"
          href="/repairs/walk-in"
        />
        <StatCard
          icon={PackageCheck}
          label={revenuePace.isRealToday ? "Services combos today" : `Services combos, ${dayLabel}`}
          value={todayActivity.packagesSoldCount}
          detail={`${todayActivity.packagesByType.Yamalube} Yamalube · ${todayActivity.packagesByType["Rock Oil"]} Rock Oil`}
          color="text-teal-700 bg-teal-500/10"
          href="/packages"
        />
      </div>
      </Section>

      <Section title="This month">
      <RevenuePace
        data={revenuePace}
        title={onlyBranch ? `Revenue run-rate, ${branchLabel(onlyBranch)}` : "Revenue run-rate, all branches"}
      />

      <MonthlyPaceChart
        points={monthlyTargetHistory}
        workingDaysRemaining={revenuePace.branches[0]?.workingDaysRemaining ?? 0}
        title={onlyBranch ? `Pace to target, ${branchLabel(onlyBranch)}` : "Pace to target"}
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

      <Section title="Last 6 months">
        <MonthlyTrends points={trendPoints} />
      </Section>

      <Section title={onlyBranch ? "Mechanics" : "Branches"}>
        {onlyBranch ? <BranchMechanicLeaderboard rows={branchMechanicRows} /> : <BranchBreakdownTable rows={rows} />}
      </Section>
    </div>
  );
}
