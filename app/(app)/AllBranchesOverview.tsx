import Link from "next/link";
import { AlertTriangle, ShieldCheck, ClipboardList, Wrench, Wallet, Layers, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency, monthLabel } from "@/lib/format";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import StatCard from "@/components/StatCard";
import CombinedTargetEditor from "./CombinedTargetEditor";
import BranchBreakdownTable, { getBranchBreakdown, getAllBranchesAchievedTotal } from "./BranchBreakdownTable";
import MonthlyTrends from "./MonthlyTrends";
import {
  getAllBranchesOverdueRestoreBikeJobs,
  getAllBranchesOverdueQcJobs,
  getAllBranchesActiveRepairJobs,
  getActiveRepairJobs,
  getAllBranchesPendingApprovalJobs,
} from "@/lib/repairs-actions";
import { getBranchMonthSummary } from "@/lib/reports-actions";
import { getMonthlyTrends } from "@/lib/trends-actions";
import { getRevenuePace } from "@/lib/revenue-pace-actions";
import RevenuePace from "./RevenuePace";
import {
  getWarrantyClaimStatusBreakdown,
  getPackageSalesBreakdown,
  getMechanicsNotActiveToday,
  getTodayActivity,
} from "@/lib/dashboard-breakdowns-actions";
import IdleMechanicsNotice from "./IdleMechanicsNotice";

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
    overdueJobs,
    overdueQcJobs,
    pendingApprovalJobs,
    prevAchieved,
    trendPoints,
    revenuePace,
    claimStatusBreakdown,
    packageBreakdown,
    activeJobs,
    idleMechanics,
    todayActivity,
  ] = await Promise.all([
    getBranchBreakdown(year, month),
    getAllBranchesOverdueRestoreBikeJobs(onlyBranch),
    getAllBranchesOverdueQcJobs(onlyBranch),
    isManagement ? getAllBranchesPendingApprovalJobs(onlyBranch) : Promise.resolve([]),
    onlyBranch
      ? getBranchMonthSummary(onlyBranch, prev.year, prev.month).then((s) => s.achievedAmount)
      : getAllBranchesAchievedTotal(prev.year, prev.month),
    getMonthlyTrends(year, month, 6, onlyBranch),
    getRevenuePace(year, month, onlyBranch),
    getWarrantyClaimStatusBreakdown(year, month, onlyBranch),
    getPackageSalesBreakdown(year, month),
    onlyBranch ? getActiveRepairJobs(onlyBranch) : getAllBranchesActiveRepairJobs(),
    getMechanicsNotActiveToday(onlyBranch),
    getTodayActivity(onlyBranch),
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

  // Same 5-day overdue cutoff as the "running past 5 days" alert below —
  // amber is the 3-5 day warning zone before a job actually goes red. Jobs
  // that haven't started yet (no startedDate) aren't running the clock, so
  // they count as green rather than being left out entirely.
  const restoreBikeStatusCounts = activeJobs
    .filter((j) => j.jobType === "Restore Bike")
    .reduce(
      (acc, j) => {
        const days = j.startedDate ? Math.floor((Date.now() - new Date(j.startedDate).getTime()) / 86400000) : null;
        if (days === null || days < 3) acc.green += 1;
        else if (days <= 5) acc.amber += 1;
        else acc.red += 1;
        return acc;
      },
      { green: 0, amber: 0, red: 0 }
    );

  // Month-over-month change vs the same combined-achieved figure last month.
  // No badge when there's nothing to compare against (e.g. a brand new month).
  const trendPct = prevAchieved > 0 ? Math.round(((totals.achieved - prevAchieved) / prevAchieved) * 100) : null;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-600 mb-1">
              <Layers size={13} className="text-indigo-600" />
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
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {isManagement && pendingApprovalJobs.length > 0 && (
        <Link
          href="/repairs"
          className="block bg-indigo-50 border border-indigo-200 rounded-xl p-5 hover:border-indigo-300 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
              <ShieldCheck size={17} className="text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-indigo-700">
                {pendingApprovalJobs.length} Restore Bike job{pendingApprovalJobs.length === 1 ? "" : "s"} waiting on your
                approval
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                {pendingApprovalJobs
                  .slice(0, 6)
                  .map((j) => j.plateNo)
                  .join(", ")}
                {pendingApprovalJobs.length > 6 ? `, +${pendingApprovalJobs.length - 6} more` : ""} — the PIC can't
                start repair until you approve.
              </p>
            </div>
          </div>
        </Link>
      )}

      <IdleMechanicsNotice mechanics={idleMechanics} />

      <RevenuePace
        data={revenuePace}
        title={onlyBranch ? `Revenue Run-Rate — ${branchLabel(onlyBranch)}` : "Revenue Run-Rate — all branches"}
      />

      <MonthlyTrends
        points={trendPoints}
        claimStatusBreakdown={claimStatusBreakdown}
        packageBreakdown={packageBreakdown}
        restoreBikeStatusCounts={restoreBikeStatusCounts}
        onlyBranch={onlyBranch}
      />

      {overdueJobs.length > 0 && (
        <Link
          href="/repairs"
          className="block bg-red-50 border border-red-200 rounded-xl p-5 hover:border-red-300 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={17} className="text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700">
                {overdueJobs.length} Restore Bike job{overdueJobs.length === 1 ? "" : "s"} running past 5 days —
                check if finished
              </p>
              <p className="text-xs text-red-600 mt-1">
                {overdueJobs
                  .slice(0, 6)
                  .map((j) => `${j.plateNo} (${j.daysRunning}d)`)
                  .join(", ")}
                {overdueJobs.length > 6 ? `, +${overdueJobs.length - 6} more` : ""}
              </p>
            </div>
          </div>
        </Link>
      )}

      {overdueQcJobs.length > 0 && (
        <Link
          href="/repairs"
          className="block bg-red-50 border border-red-200 rounded-xl p-5 hover:border-red-300 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={17} className="text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700">
                {overdueQcJobs.length} job{overdueQcJobs.length === 1 ? "" : "s"} waiting on QC past 3 days — check
                with the branch PIC
              </p>
              <p className="text-xs text-red-600 mt-1">
                {overdueQcJobs
                  .slice(0, 6)
                  .map((j) => `${j.plateNo} — ${j.picName || "no PIC"} (${j.daysWaiting}d)`)
                  .join(", ")}
                {overdueQcJobs.length > 6 ? `, +${overdueQcJobs.length - 6} more` : ""}
              </p>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
        <StatCard
          icon={ClipboardList}
          label="Jobsheet Today"
          value={todayActivity.jobsheetCount}
          color="text-purple-700 bg-purple-500/10"
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
          icon={Wrench}
          label="Restore Bike Today"
          value={todayActivity.restoreBikeCount}
          color="text-sky-700 bg-sky-500/10"
          href="/repairs"
        />
      </div>

      {!onlyBranch && <BranchBreakdownTable rows={rows} />}
    </div>
  );
}
