"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Crown, Wrench, Smartphone, Download, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { formatCurrency, toCsv } from "@/lib/format";
import { BRANCHES, branchLabel, type BranchSelection } from "@/lib/branch";
import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import { MECHANIC_KPI_REVENUE, MECHANIC_KPI_RESTORE_BIKE_COUNT, MECHANIC_KPI_DAILY_TARGET, MECHANIC_KPI_WORKING_DAYS } from "@/lib/types";

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
      <span className="text-[10px] text-neutral-400">≈ {formatCurrency(MECHANIC_KPI_DAILY_TARGET)}/day min.</span>
    </div>
  );
}

function PackageRow({ r, isTop }: { r: MechanicPerformanceRowWithBranch; isTop: boolean }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {isTop && r.packageSetsSold > 0 && <Crown size={14} className="text-amber-500" />}
          {r.fullName} <span className="text-neutral-500 font-normal">({r.shortCode})</span>
        </span>
      </td>
      <td className="px-5 py-3.5 text-neutral-900 font-semibold whitespace-nowrap">{r.packageSetsSold} sets</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{formatCurrency(r.packageRevenue)}</td>
    </tr>
  );
}

// How much revenue and how many jobs a mechanic averages per day so far
// this month — the actual pace behind the RM400/day KPI reference, not
// just the target. Divides by daysElapsed (today's date-of-month, or the
// full month once it's over) rather than a fixed 25 working days, so it
// reflects real progress rather than an idealized denominator.
function DailyPaceCell({ r, daysElapsed }: { r: MechanicPerformanceRowWithBranch; daysElapsed: number }) {
  const totalJobs = r.restoreBikeCount + r.walkInCount;
  const revenuePerDay = daysElapsed > 0 ? r.totalRevenue / daysElapsed : 0;
  const jobsPerDay = daysElapsed > 0 ? totalJobs / daysElapsed : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-neutral-800">{formatCurrency(revenuePerDay)}/day</span>
      <span className="text-xs text-neutral-500">{jobsPerDay.toFixed(2)} jobs/day</span>
    </div>
  );
}

function RevenueRow({
  r,
  isTop,
  isTopRestoreBike,
  daysElapsed,
}: {
  r: MechanicPerformanceRowWithBranch;
  isTop: boolean;
  isTopRestoreBike: boolean;
  daysElapsed: number;
}) {
  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {isTop && r.totalRevenue > 0 && <Crown size={14} className="text-amber-500" />}
          {r.fullName} <span className="text-neutral-500 font-normal">({r.shortCode})</span>
          {isTopRestoreBike && (
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
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <Smartphone size={12} className="text-sky-500" /> {r.genbluCount} new
        </span>
      </td>
      <td className="px-5 py-3.5 text-neutral-900 font-semibold whitespace-nowrap">{formatCurrency(r.totalRevenue)}</td>
      <td className="px-5 py-3.5">
        <DailyPaceCell r={r} daysElapsed={daysElapsed} />
      </td>
      <td className="px-5 py-3.5">
        <KpiCell revenue={r.restoreBikeRevenue} count={r.restoreBikeCount} />
      </td>
    </tr>
  );
}

type View = "revenue" | "packages";

export default function AllBranchesMechanicPerformanceClient({
  rows,
  branchSelection,
  locked,
  daysElapsed,
}: {
  rows: MechanicPerformanceRowWithBranch[];
  branchSelection?: BranchSelection;
  locked?: boolean;
  daysElapsed: number;
}) {
  const [branchFilter, setBranchFilter] = useState<BranchSelection>(branchSelection ?? "all");
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

  // Viewing "All Branches" groups the list under a highlighted per-branch
  // total row instead of one flat ranking — otherwise there's no way to
  // tell which branch a mechanic belongs to now that the Branch column is
  // gone (it's redundant with the branch dropdown for a single branch, but
  // not when everyone's mixed together). Each branch's own rows stay in
  // the same order as the global sort, so the ranking within a branch is
  // still by revenue/packages.
  const grouped = branchFilter === "all";
  const groups = useMemo(() => {
    if (!grouped) return [];
    return BRANCHES.map(({ value: branch }) => ({ branch, rows: filtered.filter((r) => r.branch === branch) })).filter(
      (g) => g.rows.length > 0
    );
  }, [filtered, grouped]);

  useEffect(() => {
    setShowAll(false);
  }, [branchFilter, view]);

  // Grouped view always shows everyone (organized into per-branch
  // sections already keeps it readable); the flat single-branch view
  // still collapses long lists behind "View All".
  const visible = grouped ? filtered : showAll ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const hiddenCount = filtered.length - visible.length;

  const topRestoreBikeId = filtered.reduce<{ id: string; revenue: number } | null>((top, r) => {
    if (r.restoreBikeRevenue > 0 && (!top || r.restoreBikeRevenue > top.revenue)) {
      return { id: r.mechanicId, revenue: r.restoreBikeRevenue };
    }
    return top;
  }, null)?.id;

  // The crown marks the single top earner in the current sort — computed
  // from filtered[0] rather than a row's position in the table, since
  // grouping by branch means each branch's first row is no longer
  // necessarily index 0 of the overall list.
  const topOverallId = filtered[0]?.mechanicId;

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
        "New GenBlu Users",
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
        r.genbluCount,
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
            {view === "packages"
              ? "Total packages sold per mechanic this month"
              : `Total revenue per mechanic this month · KPI is ${formatCurrency(MECHANIC_KPI_REVENUE)} Restore Bike revenue over ${MECHANIC_KPI_WORKING_DAYS} working days (${formatCurrency(MECHANIC_KPI_DAILY_TARGET)}/day minimum)`}
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
          {!locked && (
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
          )}
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
                {grouped
                  ? groups.map((g) => (
                      <Fragment key={g.branch}>
                        <tr className="bg-emerald-50">
                          <td className="px-5 py-2.5 text-emerald-800 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">
                            {branchLabel(g.branch)} — Branch Total
                          </td>
                          <td className="px-5 py-2.5 text-emerald-800 font-semibold text-sm whitespace-nowrap">
                            {g.rows.reduce((sum, r) => sum + r.packageSetsSold, 0)} sets
                          </td>
                          <td />
                        </tr>
                        {g.rows.map((r) => (
                          <PackageRow key={r.mechanicId} r={r} isTop={r.mechanicId === topOverallId} />
                        ))}
                      </Fragment>
                    ))
                  : visible.map((r) => <PackageRow key={r.mechanicId} r={r} isTop={r.mechanicId === topOverallId} />)}
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
                  <th className="font-medium px-5 py-3 whitespace-nowrap">GenBlu</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Total Revenue</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Daily Pace</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">KPI (RM10k / 2 bikes)</th>
                </tr>
              </thead>
              <tbody>
                {grouped
                  ? groups.map((g) => (
                      <Fragment key={g.branch}>
                        <tr className="bg-emerald-50">
                          <td className="px-5 py-2.5 text-emerald-800 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">
                            {branchLabel(g.branch)} — Branch Total
                          </td>
                          <td colSpan={4} />
                          <td className="px-5 py-2.5 text-emerald-800 font-semibold text-sm whitespace-nowrap">
                            {formatCurrency(g.rows.reduce((sum, r) => sum + r.totalRevenue, 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                        {g.rows.map((r) => (
                          <RevenueRow
                            key={r.mechanicId}
                            r={r}
                            isTop={r.mechanicId === topOverallId}
                            isTopRestoreBike={r.mechanicId === topRestoreBikeId}
                            daysElapsed={daysElapsed}
                          />
                        ))}
                      </Fragment>
                    ))
                  : visible.map((r) => (
                      <RevenueRow
                        key={r.mechanicId}
                        r={r}
                        isTop={r.mechanicId === topOverallId}
                        isTopRestoreBike={r.mechanicId === topRestoreBikeId}
                        daysElapsed={daysElapsed}
                      />
                    ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-neutral-500 text-sm">
                      No mechanics {branchFilter === "all" ? "yet" : `at ${branchLabel(branchFilter)} yet`}.
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
      {!grouped && filtered.length > COLLAPSED_COUNT && (
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
