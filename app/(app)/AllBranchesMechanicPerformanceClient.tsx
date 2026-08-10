"use client";

import { useMemo, useState } from "react";
import { Crown, Wrench, Download } from "lucide-react";
import { formatCurrency, toCsv } from "@/lib/format";
import { BRANCHES, branchLabel, type BranchSelection } from "@/lib/branch";
import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";

export default function AllBranchesMechanicPerformanceClient({ rows }: { rows: MechanicPerformanceRowWithBranch[] }) {
  const [branchFilter, setBranchFilter] = useState<BranchSelection>("all");

  const filtered = useMemo(
    () => (branchFilter === "all" ? rows : rows.filter((r) => r.branch === branchFilter)),
    [rows, branchFilter]
  );

  const topRestoreBikeId = filtered.reduce<{ id: string; revenue: number } | null>((top, r) => {
    if (r.restoreBikeRevenue > 0 && (!top || r.restoreBikeRevenue > top.revenue)) {
      return { id: r.mechanicId, revenue: r.restoreBikeRevenue };
    }
    return top;
  }, null)?.id;

  function handleExport() {
    const csv = toCsv(
      ["Mechanic", "Code", "Branch", "Restore Bike Jobs", "Restore Bike Revenue (RM)", "Walk-in Jobs", "Walk-in Revenue (RM)", "Package Sets", "Package Revenue (RM)", "Total Revenue (RM)"],
      filtered.map((r) => [
        r.fullName,
        r.shortCode,
        branchLabel(r.branch),
        r.restoreBikeCount,
        r.restoreBikeRevenue.toFixed(2),
        r.walkInCount,
        r.walkInRevenue.toFixed(2),
        r.packageSetsSold,
        r.packageRevenue.toFixed(2),
        r.totalRevenue.toFixed(2),
      ])
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bmm-mechanic-performance-${branchFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Individual Mechanic Performance</p>
          <p className="text-xs text-neutral-500 mt-0.5">Everyone can see this — Restore Bike, Walk-in, and package sales this month</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value as BranchSelection)}
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="all">All Branches</option>
            {BRANCHES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download size={15} /> Export
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Restore Bike</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Walk-in</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Packages</th>
              <th className="font-medium px-5 py-3 whitespace-nowrap">Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.mechanicId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {i === 0 && r.totalRevenue > 0 && <Crown size={14} className="text-amber-500" />}
                    {r.fullName} <span className="text-neutral-500 font-normal">({r.shortCode})</span>
                    {r.mechanicId === topRestoreBikeId && (
                      <span className="flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-0.5">
                        <Wrench size={10} /> Top Restore Bike
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{branchLabel(r.branch)}</td>
                <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
                  {r.restoreBikeCount} jobs · {formatCurrency(r.restoreBikeRevenue)}
                </td>
                <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
                  {r.walkInCount} jobs · {formatCurrency(r.walkInRevenue)}
                </td>
                <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
                  {r.packageSetsSold} sets · {formatCurrency(r.packageRevenue)}
                </td>
                <td className="px-5 py-3.5 text-neutral-900 font-semibold whitespace-nowrap">
                  {formatCurrency(r.totalRevenue)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-neutral-500 text-sm">
                  No mechanics {branchFilter === "all" ? "yet" : `at ${branchLabel(branchFilter)} yet`}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
