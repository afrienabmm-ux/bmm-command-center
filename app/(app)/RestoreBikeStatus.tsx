import { branchLabel, type Branch } from "@/lib/branch";

export type RestoreBikeStatusCounts = { green: number; red: number };
export type OverdueRestoreBikeDetail = { plateNo: string; mechanicName: string; branch: Branch; daysRunning: number };

const LIGHTS: { key: keyof RestoreBikeStatusCounts; lit: string; dim: string; label: string }[] = [
  { key: "red", lit: "bg-red-500", dim: "bg-red-950/40", label: "Overdue (past 5 days)" },
  { key: "green", lit: "bg-emerald-500", dim: "bg-emerald-950/40", label: "On track (under 5 days)" },
];

// A literal traffic light for Restore Bike jobs currently in progress —
// green or red by whether a job has been running past the 5-day repair
// SLA. Red also lists which mechanic (and branch) each overdue job belongs
// to, so it's clear who to check in with, not just how many.
export default function RestoreBikeStatus({
  counts,
  overdueDetails,
}: {
  counts: RestoreBikeStatusCounts;
  overdueDetails: OverdueRestoreBikeDetail[];
}) {
  const total = counts.green + counts.red;
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-neutral-900">Restore Bike Status</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">Active jobs, by how long they've been running</p>
      {total === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-8">No active Restore Bike jobs right now.</p>
      ) : (
        <>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="bg-neutral-800 rounded-2xl p-3 flex flex-col gap-3 shrink-0">
              {LIGHTS.map((l) => (
                <div
                  key={l.key}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                    counts[l.key] > 0 ? l.lit : l.dim
                  }`}
                >
                  {counts[l.key]}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 min-w-[140px]">
              {LIGHTS.map((l) => (
                <div key={l.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-neutral-600">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${l.lit}`} />
                    {l.label}
                  </span>
                  <span className="font-medium text-neutral-900">{counts[l.key]}</span>
                </div>
              ))}
            </div>
          </div>
          {overdueDetails.length > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-100">
              <p className="text-xs font-medium text-neutral-600 mb-2">Who's overdue</p>
              <div className="flex flex-col gap-1.5">
                {overdueDetails.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-neutral-700">
                      {d.plateNo} — {d.mechanicName} <span className="text-neutral-400">({branchLabel(d.branch)})</span>
                    </span>
                    <span className="text-red-600 font-medium whitespace-nowrap">{d.daysRunning}d</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
