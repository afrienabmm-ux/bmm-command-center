"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Wrench, Download, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { formatCurrency, toCsv } from "@/lib/format";
import { BRANCHES, branchLabel, type BranchSelection } from "@/lib/branch";
import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import { MECHANIC_KPI_REVENUE, MECHANIC_KPI_RESTORE_BIKE_COUNT } from "@/lib/types";

const COLLAPSED_COUNT = 5;

// Every mechanic's monthly KPI: RM10,000 Restore Bike revenue and at least
// 2 Restore Bike jobs completed. Shown as two small pass/fail pills rather
// than folded into the revenue number, since either can fail independently
// (e.g. two cheap jobs hits the count but not the revenue).
function KpiCell({ revenue, count }: { revenue: number; count: number }) {
  const revenueMet = revenue >= MECHANIC_KPI_REVENUE;
  const countMet = count >= MECHANIC_KPI_RESTORE_BIKE_COUNT;
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border w-fit ${
          revenueMet
            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
            : "bg-neutral-100 text-neutral-600 border-neutral-300"
        }`}
      >
        {revenueMet ? <Check size={11} /> : <X size={11} />}
        {formatCurrency(revenue)} / {formatCurrency(MECHANIC_KPI_REVENUE)}
      </span>
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border w-fit ${
          countMet
            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
            : "bg-neutral-100 text-neutral-600 border-neutral-300"
        }`}
      >
        {countMet ? <Check size={11} /> : <X size={11} />}
        {count} / {MECHANIC_KPI_RESTORE_BIKE_COUNT} bikes
      </span>
    </div>
  );
}

type View = "revenue" | "packages";

export default function AllBranchesMechanicPerformanceClient({ rows }: { rows: MechanicPerformanceRowWithBranch[] }) {
  const [branchFilter, setBranchFilter] = useState<BranchSelection>("all");
  const [view, setView] = useState<View>("revenue");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const base = branchFilter === "all" ? rows : rows.filter((r) => r.branch === branchFilter);
    const sorted = [...base];
    if (view === "packages") {
      sorted.sort((a, b) => b.packageSetsSold - a.packageSetsSold);
    } else {
      sorted.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }
    return sorted;
  }, [rows, branchFilter, view]);

  useEffect(() => {
    setShowAll(false);
  }, [branchFilter, view]);

  const visible = showAll ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const hiddenCount = filtered.length - visible.length;

  const topRestoreBikeId = filtered.reduce<{ id: string; revenue: number } | null>((top, r) => {
    if (r.restoreBikeRevenue > 0 && (!top || r.restoreBikeRevenue > top.revenue)) {
      return { id: r.mechanicId, revenue: r.restoreBikeRevenue };
    }
    return top;
  }, null)?.id;

  function handleExport() {
    const csv = toCsv(
      [
        "Mechanic",
        "Code",
        "Restore Bike Jobs",
        "Restore Bike Revenue (RM)",
        "Jobsheet Jobs",
        "Jobsheet Revenue (RM)",
        "Package Sets",
        "Package Revenue (RM)",
        "Total Revenue (RM)",
        "Revenue KPI Met (RM10k)",
        "Bike Count KPI Met (2 bikes)",
      ],
      filtered.map((r) => [
        r.fullName,
        r.shortCode,
        r.restoreBikeCount,
        r.restoreBikeRevenue.toFixed(2),
        r.walkInCount,
        r.walkInRevenue.toFixed(2),
        r.packageSetsSold,
        r.packageRevenue.toFixed(2),
        r.totalRevenue.toFixed(2),
        r.restoreBikeRevenue >= MECHANIC_KPI_REVENUE ? "Yes" : "No",
        r.restoreBikeCount >= MECHANIC_KPI_RESTORE_BIKE_COUNT ? "Yes" : "No",
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
          <p className="text-xs text-neutral-500 mt-0.5">
            {view === "packages" ? "Total packages sold per mechanic this month" : "Total revenue per mechanic this month"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-neutral-50 border border-neutral-200 rounded-lg p-1">
            <button
              onClick={() => setView("packages")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                view === "packages" ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              Total Packages
            </button>
            <button
              onClick={() => setView("revenue")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                view === "revenue" ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              Total Revenue
            </button>
          </div>
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
          {view === "packages" ? (
            <>
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Package Sets Sold</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Package Revenue</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.mechanicId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {i === 0 && r.packageSetsSold > 0 && <Crown size={14} className="text-amber-500" />}
                        {r.fullName} <span className="text-neutral-500 font-normal">({r.shortCode})</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-neutral-900 font-semibold whitespace-nowrap">{r.packageSetsSold} sets</td>
                    <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{formatCurrency(r.packageRevenue)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-neutral-500 text-sm">
                      No mechanics {branchFilter === "all" ? "yet" : `at ${branchLabel(branchFilter)} yet`}.
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Restore Bike</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Jobsheet</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Packages</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Total Revenue</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">KPI (RM10k / 2 bikes)</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
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
                    <td className="px-5 py-3.5">
                      <KpiCell revenue={r.restoreBikeRevenue} count={r.restoreBikeCount} />
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
            </>
          )}
        </table>
      </div>
      {filtered.length > COLLAPSED_COUNT && (
        <div className="px-5 py-3 border-t border-neutral-200">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {showAll ? (
              <>
                <ChevronUp size={15} /> Show Less
              </>
            ) : (
              <>
                <ChevronDown size={15} /> View All ({hiddenCount} more)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
