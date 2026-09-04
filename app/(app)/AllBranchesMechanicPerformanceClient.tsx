"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Crown, Wrench, Smartphone, Download, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus, Search, Target, BarChart3 } from "lucide-react";
import { formatCurrency, formatShortDate, toCsv } from "@/lib/format";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import type { MechanicCommitmentRow } from "@/lib/mechanic-commitment-actions";
import { MECHANIC_KPI_REVENUE, MECHANIC_KPI_RESTORE_BIKE_COUNT, MECHANIC_KPI_WORKING_DAYS } from "@/lib/types";

const COLLAPSED_COUNT = 5;

function TodayProgressBar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="w-24 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-400"}`}
        style={{ width: `${pct}%` }}
      />
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

// This month's total revenue vs the same mechanic's total last month — a
// flat green/red/neutral badge, same read as the Dashboard's target-banner
// trend badge. No badge when there's nothing to compare against (e.g. the
// mechanic wasn't around last month).
function TrendBadge({ current, previous }: { current: number; previous: number | undefined }) {
  if (!previous || previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
        <Minus size={10} /> Same as last month
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
        pct > 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"
      }`}
    >
      {pct > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(pct)}% vs last month
    </span>
  );
}

function RevenueRow({
  r,
  isTop,
  isTopRestoreBike,
  prevRevenue,
  today,
}: {
  r: MechanicPerformanceRowWithBranch;
  isTop: boolean;
  isTopRestoreBike: boolean;
  prevRevenue: number | undefined;
  today: MechanicCommitmentRow | undefined;
}) {
  const dailyTarget = today?.dailyTarget ?? 0;
  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {isTop && r.totalRevenue > 0 && <Crown size={14} className="text-amber-500" />}
          {r.fullName} <span className="text-neutral-500 font-normal">({r.shortCode})</span>
          {isTopRestoreBike && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
              <Wrench size={10} /> Top Restore Bike
            </span>
          )}
        </span>
      </td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{r.walkInCount} jobs</td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-neutral-800 font-medium">{formatCurrency(today?.revenue ?? 0)}</span>
          <TodayProgressBar value={today?.revenue ?? 0} target={dailyTarget} />
        </div>
      </td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{r.restoreBikeCount} jobs</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
        {r.packageSetsSold} sets · {formatCurrency(r.packageRevenue)}
      </td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <Smartphone size={12} className="text-sky-500" /> {r.genbluCount} new
        </span>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <div className="flex flex-col gap-1 items-start">
          <span className="text-neutral-900 font-semibold">{formatCurrency(r.totalRevenue)}</span>
          <TrendBadge current={r.totalRevenue} previous={prevRevenue} />
        </div>
      </td>
    </tr>
  );
}

type View = "revenue" | "packages";

export default function AllBranchesMechanicPerformanceClient({
  rows,
  branchSelection,
  locked,
  prevRevenueByMechanicId,
  commitmentByMechanicId,
  targetByBranch,
  weekAchievedByBranch,
  selectedDate,
  isToday = true,
}: {
  rows: MechanicPerformanceRowWithBranch[];
  branchSelection?: BranchSelection;
  locked?: boolean;
  prevRevenueByMechanicId: Record<string, number>;
  commitmentByMechanicId: Record<string, MechanicCommitmentRow>;
  targetByBranch: Record<Branch, number>;
  weekAchievedByBranch: Record<Branch, number>;
  selectedDate?: string;
  isToday?: boolean;
}) {
  // Sales Performance lets the GM pick a past day to review its pace
  // instead of always showing today's — every "Today" label below adapts
  // to whichever day is actually selected.
  const dayLabel = isToday || !selectedDate ? "Today" : formatShortDate(selectedDate);
  const dayLabelLower = isToday || !selectedDate ? "today" : dayLabel;
  const [branchFilter, setBranchFilter] = useState<BranchSelection>(branchSelection ?? "all");
  const [view, setView] = useState<View>("revenue");
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

  // Switching branches with the top-level selector (in the page header)
  // re-renders this component with a new branchSelection prop, but a plain
  // useState only reads that prop once, on first mount — without this, the
  // table's own dropdown below stayed stuck on whatever branch was active
  // when the page first loaded, out of sync with the header.
  useEffect(() => {
    setBranchFilter(branchSelection ?? "all");
  }, [branchSelection]);

  const filtered = useMemo(() => {
    const branchScoped = branchFilter === "all" ? rows : rows.filter((r) => r.branch === branchFilter);
    const q = query.trim().toLowerCase();
    const base = q
      ? branchScoped.filter((r) => r.fullName.toLowerCase().includes(q) || r.shortCode.toLowerCase().includes(q))
      : branchScoped;
    const sorted = [...base];
    if (view === "packages") {
      sorted.sort((a, b) => b.packageSetsSold - a.packageSetsSold);
    } else {
      sorted.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }
    return sorted;
  }, [rows, branchFilter, view, query]);

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
  }, [branchFilter, view, query]);

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

  // Today's team snapshot, scoped to whatever's currently filtered — same
  // on-track/behind read that used to live in its own separate section.
  const todayRows = filtered.map((r) => commitmentByMechanicId[r.mechanicId]).filter((c): c is MechanicCommitmentRow => !!c);
  const onTrackCount = todayRows.filter((c) => c.onTrack).length;
  const behindCount = todayRows.length - onTrackCount;
  const teamRevenueToday = todayRows.reduce((s, c) => s + c.revenue, 0);
  const teamJobsToday = todayRows.reduce((s, c) => s + c.jobCount, 0);
  // Each mechanic's own dailyTarget already accounts for their branch's
  // monthly target and headcount — summing them gives the right team total
  // even when the currently-filtered set spans branches with different
  // targets and mechanic counts.
  const teamDailyTarget = todayRows.reduce((s, c) => s + c.dailyTarget, 0);

  // This week's target/achieved (not the month's) — the working week the
  // currently selected day falls in — scoped to the same branch filter as
  // everything else in this card. Both numbers are already on hand
  // per-branch, so switching the dropdown re-scopes with no round trip.
  const scopedTarget =
    branchFilter === "all" ? BRANCHES.reduce((s, b) => s + targetByBranch[b.value], 0) : targetByBranch[branchFilter];
  const achievedAmount =
    branchFilter === "all"
      ? BRANCHES.reduce((s, b) => s + weekAchievedByBranch[b.value], 0)
      : weekAchievedByBranch[branchFilter];
  const targetPct = scopedTarget > 0 ? Math.round((achievedAmount / scopedTarget) * 100) : 0;

  function handleExport() {
    const csv = toCsv(
      [
        "Mechanic",
        "Code",
        "Jobsheet Jobs",
        "Jobsheet Revenue (RM)",
        `Revenue ${dayLabel} (RM)`,
        "Restore Bike Jobs",
        "Restore Bike Revenue (RM)",
        "Package Sets",
        "Package Revenue (RM)",
        "New GenBlu Users",
        "Total Revenue (RM)",
        "Revenue KPI Met (RM10k)",
        "Bike Count KPI Met (2 bikes)",
      ],
      filtered.map((r) => {
        const today = commitmentByMechanicId[r.mechanicId];
        return [
          r.fullName,
          r.shortCode,
          r.walkInCount,
          r.walkInRevenue.toFixed(2),
          (today?.revenue ?? 0).toFixed(2),
          r.restoreBikeCount,
          r.restoreBikeRevenue.toFixed(2),
          r.packageSetsSold,
          r.packageRevenue.toFixed(2),
          r.genbluCount,
          r.totalRevenue.toFixed(2),
          r.restoreBikeRevenue >= MECHANIC_KPI_REVENUE ? "Yes" : "No",
          r.restoreBikeCount >= MECHANIC_KPI_RESTORE_BIKE_COUNT ? "Yes" : "No",
        ];
      })
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
          <p className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
            <Target size={15} className="text-red-500" /> Mechanic Performance
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {view === "packages"
              ? "Total packages sold per mechanic this month"
              : `${isToday ? "Today's" : `${dayLabel}'s`} pace (each mechanic's own branch target ÷ ${MECHANIC_KPI_WORKING_DAYS} days ÷ headcount) plus this month's revenue by source · KPI is ${formatCurrency(MECHANIC_KPI_REVENUE)} Restore Bike revenue over ${MECHANIC_KPI_WORKING_DAYS} working days`}
          </p>
        </div>
        {view === "revenue" && todayRows.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              {onTrackCount} on track {dayLabelLower}
            </span>
            {behindCount > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-700 border border-red-500/20">
                {behindCount} behind
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mechanic…"
              className="bg-neutral-50 border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-40"
            />
          </div>
          <div className="flex gap-1 bg-neutral-50 border border-neutral-200 rounded-lg p-1">
            <button
              onClick={() => setView("packages")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                view === "packages" ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              Total Packages
            </button>
            <button
              onClick={() => setView("revenue")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                view === "revenue" ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              Total Revenue
            </button>
          </div>
          {!locked && (
            <div className="relative">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value as BranchSelection)}
                className="appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3 pr-8 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
              >
                <option value="all">All Branches</option>
                {BRANCHES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download size={15} /> Export
          </button>
        </div>
      </div>
      {view === "revenue" && todayRows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 border-b border-neutral-200">
          <div className="bg-white border border-neutral-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-neutral-500 tracking-wide">WEEKLY TARGET</p>
              <Target size={14} className="text-red-500" />
            </div>
            <p className="text-xl font-semibold text-neutral-900 mt-1">{formatCurrency(scopedTarget)}</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {branchFilter === "all" ? "all branches" : branchLabel(branchFilter)}
            </p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-neutral-500 tracking-wide">% OF WEEKLY TARGET</p>
              <BarChart3 size={14} className="text-indigo-500" />
            </div>
            <p className="text-xl font-semibold text-neutral-900 mt-1">{targetPct}%</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {formatCurrency(achievedAmount)} / {formatCurrency(scopedTarget)}
            </p>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
            <p className="text-[11px] font-medium text-neutral-500 tracking-wide">TEAM REVENUE {dayLabel.toUpperCase()}</p>
            <p className="text-xl font-semibold text-neutral-900 mt-1">{formatCurrency(teamRevenueToday)}</p>
            <p className="text-xs text-neutral-400 mt-0.5">target {formatCurrency(teamDailyTarget)}</p>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
            <p className="text-[11px] font-medium text-neutral-500 tracking-wide">JOBS {dayLabel.toUpperCase()}</p>
            <p className="text-xl font-semibold text-neutral-900 mt-1">{teamJobsToday}</p>
            <p className="text-xs text-neutral-400 mt-0.5">across {todayRows.length} mechanics</p>
          </div>
        </div>
      )}
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
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Jobsheet</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Revenue {dayLabel}</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Restore Bike</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Packages</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">GenBlu</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Total Revenue</th>
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
                          <td colSpan={5} />
                          <td className="px-5 py-2.5 text-emerald-800 font-semibold text-sm whitespace-nowrap">
                            {formatCurrency(g.rows.reduce((sum, r) => sum + r.totalRevenue, 0))}
                          </td>
                        </tr>
                        {g.rows.map((r) => (
                          <RevenueRow
                            key={r.mechanicId}
                            r={r}
                            isTop={r.mechanicId === topOverallId}
                            isTopRestoreBike={r.mechanicId === topRestoreBikeId}
                            prevRevenue={prevRevenueByMechanicId[r.mechanicId]}
                            today={commitmentByMechanicId[r.mechanicId]}
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
                        prevRevenue={prevRevenueByMechanicId[r.mechanicId]}
                        today={commitmentByMechanicId[r.mechanicId]}
                      />
                    ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-neutral-500 text-sm">
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
            className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
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
