import Link from "next/link";
import { AlertTriangle, ShieldCheck, Wrench, Clock, Users, ClipboardList, Layers, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency, monthLabel } from "@/lib/format";
import type { Branch } from "@/lib/branch";
import StatCard from "@/components/StatCard";
import CombinedTargetEditor from "./CombinedTargetEditor";
import BranchBreakdownTable, { getBranchBreakdown, getAllBranchesAchievedTotal } from "./BranchBreakdownTable";
import AllBranchesMechanicPerformanceTable from "./AllBranchesMechanicPerformanceTable";
import MonthlyTrends from "./MonthlyTrends";
import { getAllBranchesOverdueRestoreBikeJobs, getAllBranchesActiveRepairJobs } from "@/lib/repairs-actions";
import { getAllBranchesPerformance } from "@/lib/reports-actions";
import { getMonthlyTrends } from "@/lib/trends-actions";
import { getRevenuePace } from "@/lib/revenue-pace-actions";
import RevenuePace from "./RevenuePace";
import { getWarrantyClaimStatusBreakdown, getPackageSalesBreakdown } from "@/lib/dashboard-breakdowns-actions";

// Rolls (year, month) back one month, correctly crossing a year boundary.
function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export default async function AllBranchesOverview({ year, month }: { year: number; month: number }) {
  const prev = previousMonth(year, month);
  // Fetched together (rather than each as its own async Server Component
  // further down the tree) so they run as one wave of parallel queries
  // instead of three sequential waterfalls — this was the main source of
  // dashboard lag before.
  const [rows, overdueJobs, prevAchieved, trendPoints, mechanicPerformanceRows, revenuePace, claimStatusBreakdown, packageBreakdown, activeJobs] =
    await Promise.all([
      getBranchBreakdown(year, month),
      getAllBranchesOverdueRestoreBikeJobs(),
      getAllBranchesAchievedTotal(prev.year, prev.month),
      getMonthlyTrends(year, month, 6),
      getAllBranchesPerformance(year, month),
      getRevenuePace(year, month),
      getWarrantyClaimStatusBreakdown(year, month),
      getPackageSalesBreakdown(year, month),
      getAllBranchesActiveRepairJobs(),
    ]);

  const totals = rows.reduce(
    (acc, b) => ({
      target: acc.target + b.target,
      achieved: acc.achieved + b.achieved,
      approvedClaims: acc.approvedClaims + b.approvedClaims,
      activeRepairs: acc.activeRepairs + b.activeRepairs,
      activeMechanics: acc.activeMechanics + b.activeMechanics,
    }),
    { target: 0, achieved: 0, approvedClaims: 0, activeRepairs: 0, activeMechanics: 0 }
  );
  const pct = totals.target > 0 ? Math.min(100, Math.round((totals.achieved / totals.target) * 100)) : 0;

  const restoreBikeActiveCount = activeJobs.filter((j) => j.jobType === "Restore Bike").length;
  const restoreBikeOverdueCount = overdueJobs.length;
  const restoreBikeOnTrackCount = restoreBikeActiveCount - restoreBikeOverdueCount;
  const totalJobsheetCount = activeJobs.filter((j) => j.jobType === "Walk-in").length;

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
              <span>All Branches — {monthLabel(month, year)} Target (combined)</span>
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

      <RevenuePace data={revenuePace} />

      <MonthlyTrends points={trendPoints} claimStatusBreakdown={claimStatusBreakdown} packageBreakdown={packageBreakdown} />

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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={ShieldCheck} label="Approved Claims" value={totals.approvedClaims} color="text-emerald-700 bg-emerald-500/10" href="/warranty-claims" />
        <StatCard icon={Wrench} label="Restore Bike On Track" value={restoreBikeOnTrackCount} color="text-indigo-600 bg-indigo-500/10" href="/repairs" />
        <StatCard icon={Clock} label="Restore Bike Overdue" value={restoreBikeOverdueCount} color="text-red-700 bg-red-500/10" href="/repairs" />
        <StatCard icon={Users} label="Active Mechanics" value={totals.activeMechanics} color="text-amber-700 bg-amber-500/10" href="/mechanics" />
        <StatCard icon={ClipboardList} label="Total Jobsheet" value={totalJobsheetCount} color="text-purple-700 bg-purple-500/10" href="/repairs/walk-in" />
      </div>

      <BranchBreakdownTable rows={rows} />

      <AllBranchesMechanicPerformanceTable rows={mechanicPerformanceRows} />
    </div>
  );
}
