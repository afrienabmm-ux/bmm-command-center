import { Fragment } from "react";
import { Flame, Target } from "lucide-react";
import type { MechanicCommitmentRow, MechanicCommitmentSummary } from "@/lib/mechanic-commitment-actions";
import { BRANCHES, branchLabel, type BranchSelection } from "@/lib/branch";
import { formatCurrency, formatDate } from "@/lib/format";

function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="w-28 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-400"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MechanicRow({ r, revenueTarget, showBranch }: { r: MechanicCommitmentRow; revenueTarget: number; showBranch: boolean }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
        {r.shortCode}
      </td>
      {showBranch && <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{branchLabel(r.branch)}</td>}
      <td className="px-5 py-3.5 text-center whitespace-nowrap">
        {r.streakDays > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-orange-600">
            <Flame size={14} className="fill-orange-500 text-orange-500" /> {r.streakDays}
          </span>
        ) : (
          <span className="text-neutral-300">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-neutral-800 font-medium whitespace-nowrap">
            {formatCurrency(r.revenue)} <span className="text-neutral-400 font-normal">/ {formatCurrency(revenueTarget)}</span>
          </span>
          <ProgressBar value={r.revenue} target={revenueTarget} />
        </div>
      </td>
      <td className="px-5 py-3.5 text-center text-neutral-700 whitespace-nowrap">
        {r.jobCount} <span className="text-neutral-400 text-xs">({r.restoreBikeCount} bike)</span>
      </td>
      <td className="px-5 py-3.5 text-center">
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            r.onTrack ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"
          }`}
        >
          {r.onTrack ? "On track" : "Behind"}
        </span>
      </td>
    </tr>
  );
}

export default function MechanicCommitmentTracker({
  summary,
  branchSelection,
}: {
  summary: MechanicCommitmentSummary;
  branchSelection: BranchSelection;
}) {
  const { rows, revenueTarget, daysElapsed, weekStart, weekEnd } = summary;
  const showBranch = branchSelection === "all";
  const onTrackCount = rows.filter((r) => r.onTrack).length;
  const behindCount = rows.length - onTrackCount;
  const teamRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const teamJobs = rows.reduce((s, r) => s + r.jobCount, 0);
  const teamTarget = revenueTarget * rows.length;

  // Same grouping as Individual Mechanic Performance — under "All
  // Branches" each branch gets its own subtotal header instead of one flat
  // ranking, since the Branch column alone doesn't visually separate them.
  const groups = showBranch
    ? BRANCHES.map(({ value: branch }) => ({ branch, rows: rows.filter((r) => r.branch === branch) })).filter(
        (g) => g.rows.length > 0
      )
    : [];

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
            <Target size={15} className="text-indigo-500" /> Mechanic Performance — this week
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Weekly target: {formatCurrency(revenueTarget)} in revenue per mechanic · {formatDate(weekStart)} –{" "}
            {formatDate(weekEnd)}
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              {onTrackCount} on track
            </span>
            {behindCount > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-700 border border-red-500/20">
                {behindCount} behind
              </span>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-10">No active mechanics yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5 border-b border-neutral-200">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
              <p className="text-[11px] font-medium text-neutral-500 tracking-wide">TEAM REVENUE THIS WEEK</p>
              <p className="text-xl font-semibold text-neutral-900 mt-1">{formatCurrency(teamRevenue)}</p>
              <p className="text-xs text-neutral-400 mt-0.5">target {formatCurrency(teamTarget)}</p>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
              <p className="text-[11px] font-medium text-neutral-500 tracking-wide">JOBS THIS WEEK</p>
              <p className="text-xl font-semibold text-neutral-900 mt-1">{teamJobs}</p>
              <p className="text-xs text-neutral-400 mt-0.5">across {rows.length} mechanics</p>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 hidden sm:block">
              <p className="text-[11px] font-medium text-neutral-500 tracking-wide">DAYS INTO THE WEEK</p>
              <p className="text-xl font-semibold text-neutral-900 mt-1">{daysElapsed} / 6</p>
              <p className="text-xs text-neutral-400 mt-0.5">working days so far</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                  {showBranch && <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>}
                  <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Streak</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Revenue (wk)</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Jobs (wk)</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {showBranch
                  ? groups.map((g) => (
                      <Fragment key={g.branch}>
                        <tr className="bg-emerald-50">
                          <td className="px-5 py-2.5 text-emerald-800 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">
                            {branchLabel(g.branch)} — Branch Total
                          </td>
                          <td colSpan={3} />
                          <td className="px-5 py-2.5 text-emerald-800 font-semibold text-sm text-center whitespace-nowrap">
                            {g.rows.reduce((sum, r) => sum + r.jobCount, 0)} jobs
                          </td>
                          <td />
                        </tr>
                        {g.rows.map((r) => (
                          <MechanicRow key={r.mechanicId} r={r} revenueTarget={revenueTarget} showBranch={showBranch} />
                        ))}
                      </Fragment>
                    ))
                  : rows.map((r) => (
                      <MechanicRow key={r.mechanicId} r={r} revenueTarget={revenueTarget} showBranch={showBranch} />
                    ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
