import { Check, X } from "lucide-react";
import { BRANCHES, branchLabel } from "@/lib/branch";
import { formatCurrency } from "@/lib/format";
import type { MechanicCommitmentRow } from "@/lib/mechanic-commitment-actions";

// Same "who's on pace today" idea as IdleMechanicsNotice, but for everyone
// at once instead of just naming the stragglers — a manager doing a
// morning check wants the full roster at a glance, not just a list of who
// to go find.
export default function TodaysJobCheck({
  rows,
  revenueTarget,
}: {
  rows: MechanicCommitmentRow[];
  revenueTarget: number;
}) {
  if (rows.length === 0) return null;
  const onTrackCount = rows.filter((r) => r.onTrack).length;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Today&apos;s Job Check</p>
          <p className="text-xs text-neutral-500 mt-0.5">Target: {formatCurrency(revenueTarget)} revenue per person.</p>
        </div>
        <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
          {onTrackCount}/{rows.length} on track
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {BRANCHES.map(({ value: branch }) => {
          const branchRows = rows.filter((r) => r.branch === branch);
          if (branchRows.length === 0) return null;
          return (
            <div key={branch}>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">{branchLabel(branch)}</p>
              <div className="flex flex-wrap gap-2">
                {branchRows.map((r) => (
                  <span
                    key={r.mechanicId}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border ${
                      r.onTrack ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-neutral-50 border-neutral-200 text-neutral-500"
                    }`}
                  >
                    {r.onTrack ? <Check size={12} className="shrink-0" /> : <X size={12} className="shrink-0" />}
                    <span className={r.onTrack ? "text-emerald-800" : ""}>{r.fullName}</span>
                    {r.onTrack && (
                      <span className="text-emerald-600">
                        {formatCurrency(r.revenue)} · {r.jobCount} job{r.jobCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
