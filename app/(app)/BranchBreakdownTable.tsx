import { getBranchMonthSummary, getTopMechanic, getTopRestoreBikeMechanic, type TopMechanic } from "@/lib/reports-actions";
import { getActiveRepairJobs } from "@/lib/repairs-actions";
import { getWarrantyClaims } from "@/lib/claims-actions";
import { getMechanics } from "@/lib/mechanics-actions";
import { getLowStockProducts } from "@/lib/catalog-actions";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { isOpenClaim } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export type BranchBreakdownRow = {
  branch: Branch;
  target: number;
  achieved: number;
  openClaims: number;
  activeRepairs: number;
  activeMechanics: number;
  lowStock: number;
  topMechanic: TopMechanic | null;
  topRestoreBike: TopMechanic | null;
};

export async function getBranchBreakdown(year: number, month: number): Promise<BranchBreakdownRow[]> {
  return Promise.all(
    BRANCHES.map(async ({ value: branch }) => {
      const [summary, claims, repairs, mechanics, lowStock, topMechanic, topRestoreBike] = await Promise.all([
        getBranchMonthSummary(branch, year, month),
        getWarrantyClaims(branch),
        getActiveRepairJobs(branch),
        getMechanics(branch),
        getLowStockProducts(branch),
        getTopMechanic(branch, year, month),
        getTopRestoreBikeMechanic(branch, year, month),
      ]);
      return {
        branch,
        target: summary.targetAmount,
        achieved: summary.achievedAmount,
        openClaims: claims.filter((c) => isOpenClaim(c.status)).length,
        activeRepairs: repairs.length,
        activeMechanics: mechanics.filter((m) => m.status === "Active").length,
        lowStock: lowStock.length,
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
              <th className="font-medium px-5 py-3 whitespace-nowrap">Target</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Achieved</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Open Claims</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Active Repairs</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Active Mechanics</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Low Stock</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Top Overall (Revenue)</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Top Restore Bike</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.branch} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-5 py-3.5 text-neutral-900 font-medium whitespace-nowrap">{branchLabel(b.branch)}</td>
                <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(b.target)}</td>
                <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(b.achieved)}</td>
                <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{b.openClaims}</td>
                <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{b.activeRepairs}</td>
                <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{b.activeMechanics}</td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  {b.lowStock > 0 ? (
                    <span className="text-red-700 font-medium">{b.lowStock}</span>
                  ) : (
                    <span className="text-neutral-500">0</span>
                  )}
                </td>
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
