import Link from "next/link";
import { AlertTriangle, ShieldCheck, Wrench, Users, PackageX, Layers } from "lucide-react";
import { getBranchMonthSummary } from "@/lib/reports-actions";
import { getActiveRepairJobs } from "@/lib/repairs-actions";
import { getWarrantyClaims } from "@/lib/claims-actions";
import { getMechanics } from "@/lib/mechanics-actions";
import { getLowStockProducts } from "@/lib/catalog-actions";
import { BRANCHES, branchLabel } from "@/lib/branch";
import { formatCurrency, monthLabel } from "@/lib/format";
import StatCard from "@/components/StatCard";
import CombinedTargetEditor from "./CombinedTargetEditor";

export default async function AllBranchesOverview({ year, month }: { year: number; month: number }) {
  const perBranch = await Promise.all(
    BRANCHES.map(async ({ value: branch }) => {
      const [summary, claims, repairs, mechanics, lowStock] = await Promise.all([
        getBranchMonthSummary(branch, year, month),
        getWarrantyClaims(branch),
        getActiveRepairJobs(branch),
        getMechanics(branch),
        getLowStockProducts(branch),
      ]);
      return {
        branch,
        target: summary.targetAmount,
        achieved: summary.achievedAmount,
        openClaims: claims.filter((c) => c.status !== "Completed" && c.status !== "Rejected").length,
        activeRepairs: repairs.length,
        activeMechanics: mechanics.filter((m) => m.status === "Active").length,
        lowStock: lowStock.length,
      };
    })
  );

  const totals = perBranch.reduce(
    (acc, b) => ({
      target: acc.target + b.target,
      achieved: acc.achieved + b.achieved,
      openClaims: acc.openClaims + b.openClaims,
      activeRepairs: acc.activeRepairs + b.activeRepairs,
      activeMechanics: acc.activeMechanics + b.activeMechanics,
      lowStock: acc.lowStock + b.lowStock,
    }),
    { target: 0, achieved: 0, openClaims: 0, activeRepairs: 0, activeMechanics: 0, lowStock: 0 }
  );
  const pct = totals.target > 0 ? Math.min(100, Math.round((totals.achieved / totals.target) * 100)) : 0;

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
            <p className="text-sm text-neutral-600 mt-1">
              {formatCurrency(totals.achieved)} achieved ({pct}%)
            </p>
          </div>
          <CombinedTargetEditor year={year} month={month} currentTotal={totals.target} />
        </div>
        <div className="mt-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {totals.lowStock > 0 && (
        <Link
          href="/catalog"
          className="block bg-red-50 border border-red-200 rounded-xl p-5 hover:border-red-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={17} className="text-red-600" />
            </div>
            <p className="text-sm font-semibold text-red-700">
              {totals.lowStock} item{totals.lowStock === 1 ? "" : "s"} running low across all branches — restock
              needed
            </p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShieldCheck} label="Open Warranty Claims" value={totals.openClaims} color="text-amber-700 bg-amber-500/10" href="/warranty-claims" />
        <StatCard icon={Wrench} label="Active Repair Jobs" value={totals.activeRepairs} color="text-indigo-600 bg-indigo-500/10" href="/repairs" />
        <StatCard icon={Users} label="Active Mechanics" value={totals.activeMechanics} color="text-emerald-700 bg-emerald-500/10" href="/mechanics" />
        <StatCard icon={PackageX} label="Low Stock Items" value={totals.lowStock} color="text-red-700 bg-red-500/10" href="/catalog" />
      </div>

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
              </tr>
            </thead>
            <tbody>
              {perBranch.map((b) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
