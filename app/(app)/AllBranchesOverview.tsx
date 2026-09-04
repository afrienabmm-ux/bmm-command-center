import Link from "next/link";
import { ClipboardList, Wallet, Layers, PackageCheck, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency, monthLabel } from "@/lib/format";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import StatCard from "@/components/StatCard";
import CombinedTargetEditor from "./CombinedTargetEditor";
import BranchBreakdownTable, { getBranchBreakdown, getAllBranchesAchievedTotal } from "./BranchBreakdownTable";
import MonthlyTrends from "./MonthlyTrends";
import { getUpcomingServiceReminders } from "@/lib/repairs-actions";
import { getBranchMonthSummary, getBranchPerformance, getMonthlyTargetHistory } from "@/lib/reports-actions";
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
import ServiceReminderBanner from "./ServiceReminderBanner";

// Rolls (year, month) back one month, correctly crossing a year boundary.
function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export default async function AllBranchesOverview({
  year,
  month,
  isManagement,
  branchSelection,
}: {
  year: number;
  month: number;
  isManagement: boolean;
  branchSelection: BranchSelection;
}) {
  const prev = previousMonth(year, month);
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
    serviceReminders,
    prevAchieved,
    trendPoints,
    revenuePace,
    monthlyTargetHistory,
    claimStatusBreakdown,
    deliveryClaimStatusBreakdown,
    packageBreakdown,
    mechanicCommitment,
    todayActivity,
    branchMechanicRows,
  ] = await Promise.all([
    getBranchBreakdown(year, month),
    // Only ever rendered for Management (see the isManagement && gate
    // below) — skipping the query entirely for everyone else saves a real
    // database round-trip on every dashboard load, not just a hidden render.
    isManagement ? getUpcomingServiceReminders(onlyBranch) : Promise.resolve([]),
    onlyBranch
      ? getBranchMonthSummary(onlyBranch, prev.year, prev.month).then((s) => s.achievedAmount)
      : getAllBranchesAchievedTotal(prev.year, prev.month),
    getMonthlyTrends(year, month, 6, onlyBranch),
    getRevenuePace(year, month, onlyBranch),
    getMonthlyTargetHistory(year, month, onlyBranch),
    getWarrantyClaimStatusBreakdown(year, month, onlyBranch),
    getDeliveryClaimStatusBreakdown(year, month, onlyBranch),
    getPackageSalesBreakdown(year, month),
    isManagement
      ? getMechanicCommitment(onlyBranch)
      : Promise.resolve({ date: "", dailyTargetByBranch: {} as Record<Branch, number>, rows: [] }),
    getTodayActivity(onlyBranch),
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
  const pct = totals.target > 0 ? Math.min(100, Math.round((totals.achieved / totals.target) * 100)) : 0;

  const serviceRevenueToday = revenuePace.branches.reduce((sum, b) => sum + b.revenueToday, 0);

  // Month-over-month change vs the same combined-achieved figure last month.
  // No badge when there's nothing to compare against (e.g. a brand new month).
  const trendPct = prevAchieved > 0 ? Math.round(((totals.achieved - prevAchieved) / prevAchieved) * 100) : null;

  return (
    <div className="space-y-8">
      {/* Headline number first: this month's target vs achieved. */}
      <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-600 mb-1">
              <Layers size={13} className="text-red-600" />
              <span>
                {onlyBranch ? branchLabel(onlyBranch) : "All Branches"} — {monthLabel(month, year)} Target
                {onlyBranch ? "" : " (combined)"}
              </span>
            </div>
            <p className="text-3xl font-semibold text-neutral-900">{formatCurrency(totals.target)}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-neutral-600">
                {formatCurrency(totals.achieved)} achieved ({pct}%)
              </p>
              {trendPct !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                    trendPct >= 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"
                  }`}
                >
                  {trendPct >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  {Math.abs(trendPct)}% vs {monthLabel(prev.month, prev.year)}
                </span>
              )}
            </div>
          </div>
          <CombinedTargetEditor
            year={year}
            month={month}
            branchTargets={rows.reduce((acc, b) => ({ ...acc, [b.branch]: b.target }), {} as Record<Branch, number>)}
          />
        </div>
        <div className="mt-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Alerts — anything that needs action or a heads-up, most urgent first. */}
      {isManagement && <ServiceReminderBanner reminders={serviceReminders} />}

      {isManagement && (
        <TodaysJobCheck rows={mechanicCommitment.rows} />
      )}

      {/* Today, at a glance. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Jobsheet Today"
          value={todayActivity.jobsheetCount}
          color="text-red-700 bg-red-500/10"
          href="/repairs/walk-in"
        />
        <StatCard
          icon={Wallet}
          label="Service Revenue Today"
          value={formatCurrency(serviceRevenueToday)}
          color="text-emerald-700 bg-emerald-500/10"
          href="/repairs/walk-in"
        />
        <StatCard
          icon={PackageCheck}
          label="Services Combo Today"
          value={todayActivity.packagesSoldCount}
          color="text-teal-700 bg-teal-500/10"
          href="/packages"
        />
      </div>

      <RevenuePace
        data={revenuePace}
        title={onlyBranch ? `Revenue Run-Rate — ${branchLabel(onlyBranch)}` : "Revenue Run-Rate — all branches"}
      />

      <MonthlyPaceChart
        points={monthlyTargetHistory}
        workingDaysRemaining={revenuePace.branches[0]?.workingDaysRemaining ?? 0}
        title={onlyBranch ? `Pace to Target — ${branchLabel(onlyBranch)}` : "Pace to Target"}
      />

      {/* Current status, at a glance — claims. */}
      <div className="max-w-md">
        <ClaimStatusPieCard
          warranty={claimStatusBreakdown}
          delivery={deliveryClaimStatusBreakdown}
          subtitle={onlyBranch ? "This month" : "All branches, this month"}
        />
      </div>

      <PackageBreakdownCharts packageBreakdown={packageBreakdown} onlyBranch={onlyBranch} />

      <MonthlyTrends points={trendPoints} />

      {onlyBranch ? <BranchMechanicLeaderboard rows={branchMechanicRows} /> : <BranchBreakdownTable rows={rows} />}
    </div>
  );
}
