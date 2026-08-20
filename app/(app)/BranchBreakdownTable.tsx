import { getBranchMonthSummary, getTopMechanic, getTopRestoreBikeMechanic, type TopMechanic } from "@/lib/reports-actions";
import { getActiveRepairJobs } from "@/lib/repairs-actions";
import { getWarrantyClaims } from "@/lib/claims-actions";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { isOpenClaim } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export type BranchBreakdownRow = {
  branch: Branch;
  target: number;
  achieved: number;
  openClaims: number;
  approvedClaims: number;
  activeRepairs: number;
  topMechanic: TopMechanic | null;
  topRestoreBike: TopMechanic | null;
};

// Sum of every branch's achieved amount for one month — used to show the
// "vs last month" trend badge next to the combined Achieved total.
export async function getAllBranchesAchievedTotal(year: number, month: number): Promise<number> {
  const summaries = await Promise.all(BRANCHES.map(({ value: branch }) => getBranchMonthSummary(branch, year, month)));
  return summaries.reduce((sum, s) => sum + s.achievedAmount, 0);
}

export async function getBranchBreakdown(year: number, month: number): Promise<BranchBreakdownRow[]> {
  return Promise.all(
    BRANCHES.map(async ({ value: branch }) => {
      const [summary, claims, repairs, topMechanic, topRestoreBike] = await Promise.all([
        getBranchMonthSummary(branch, year, month),
        getWarrantyClaims(branch),
        getActiveRepairJobs(branch),
        getTopMechanic(branch, year, month),
        getTopRestoreBikeMechanic(branch, year, month),
      ]);
      return {
        branch,
        target: summary.targetAmount,
        achieved: summary.achievedAmount,
        openClaims: claims.filter((c) => isOpenClaim(c.status)).length,
        approvedClaims: claims.filter((c) => c.status === "Proceed").length,
        activeRepairs: repairs.length,
        topMechanic,
        topRestoreBike,
      };
    })
  );
}

export default function BranchBreakdownTable({ rows }: { rows: BranchBreakdownRow[] }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-200">
        <p className="text-sm font-semibold text-neutral-900">Branch Breakdown</p>
        <p className="text-xs text-neutral-500 mt-0.5">Switch to a branch above to edit its data or its target</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Target vs Achieved</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Approved Claims</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Active Repairs</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Top Overall (Revenue)</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Top Restore Bike</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.branch} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-5 py-3.5 text-neutral-900 font-medium whitespace-nowrap">{branchLabel(b.branch)}</td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  {(() => {
                    const pct = b.target > 0 ? Math.min(100, Math.round((b.achieved / b.target) * 100)) : 0;
                    return (
                      <div className="min-w-[160px]">
                        <p className="text-xs text-neutral-600">
                          {formatCurrency(b.achieved)} <span className="text-neutral-400">/ {formatCurrency(b.target)}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden shrink-0">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-neutral-500">{pct}%</span>
                        </div>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{b.approvedClaims}</td>
                <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{b.activeRepairs}</td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  {b.topMechanic ? (
                    <span className="text-emerald-700 font-medium">
                      {b.topMechanic.fullName} ({b.topMechanic.shortCode}) — {formatCurrency(b.topMechanic.totalRevenue)}
                    </span>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  {b.topRestoreBike ? (
                    <span className="text-purple-700 font-medium">
                      {b.topRestoreBike.fullName} ({b.topRestoreBike.shortCode}) — {formatCurrency(b.topRestoreBike.totalRevenue)}
                    </span>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
