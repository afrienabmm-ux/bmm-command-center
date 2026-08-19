export type RestoreBikeStatusCounts = { green: number; amber: number; red: number };

const LIGHTS: { key: keyof RestoreBikeStatusCounts; lit: string; dim: string; label: string }[] = [
  { key: "red", lit: "bg-red-500", dim: "bg-red-950/40", label: "Overdue (past 5 days)" },
  { key: "amber", lit: "bg-amber-400", dim: "bg-amber-950/40", label: "Getting close (3–5 days)" },
  { key: "green", lit: "bg-emerald-500", dim: "bg-emerald-950/40", label: "On track (under 3 days)" },
];

// A literal traffic light for Restore Bike jobs currently in progress —
// red/amber/green by how many days a job has been running since it
// started, using the same 5-day overdue cutoff as the rest of the
// dashboard. A light stays dim (not fully lit) when its count is zero, the
// same way a real signal only lights the phase that's active.
export default function RestoreBikeStatus({ counts }: { counts: RestoreBikeStatusCounts }) {
  const total = counts.green + counts.amber + counts.red;
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-neutral-900">Restore Bike Status</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">Active jobs, by how long they've been running</p>
      {total === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-8">No active Restore Bike jobs right now.</p>
      ) : (
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
      )}
    </div>
  );
}
