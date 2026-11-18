import { Check, X } from "lucide-react";
import { BRANCHES, branchLabel } from "@/lib/branch";
import type { MechanicCommitmentRow } from "@/lib/mechanic-commitment-actions";

// Who's uploaded a jobsheet today vs who hasn't — a manager doing a morning
// check wants the full roster at a glance, not just a list of stragglers.
// Green/checked just means "has logged at least one job today" — no
// revenue detail, this is purely an activity check.
// Names are stored in capitals ("IRFAN FAHMY"); shown as "Irfan Fahmy".
function nameCase(name: string): string {
  return name.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

export default function TodaysJobCheck({ rows }: { rows: MechanicCommitmentRow[] }) {
  if (rows.length === 0) return null;
  const activeCount = rows.filter((r) => r.jobCount > 0).length;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Today&apos;s job check</p>
          <p className="text-xs text-neutral-500 mt-0.5">Mechanics who uploaded a jobsheet today</p>
        </div>
        <p className="text-sm text-neutral-600 whitespace-nowrap shrink-0 tabular-nums">
          <span className="font-semibold text-neutral-900">{activeCount}</span> of {rows.length} uploaded
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {BRANCHES.map(({ value: branch }) => {
          const branchRows = rows.filter((r) => r.branch === branch);
          if (branchRows.length === 0) return null;
          return (
            <div key={branch}>
              <p className="text-xs font-medium text-neutral-500 mb-2">{branchLabel(branch)}</p>
              <div className="flex flex-wrap gap-2">
                {branchRows.map((r) => {
                  const active = r.jobCount > 0;
                  return (
                    <span
                      key={r.mechanicId}
                      className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg border ${
                        active ? "border-neutral-200 bg-white text-neutral-900" : "border-red-200 bg-red-50/60 text-red-800"
                      }`}
                    >
                      {active ? (
                        <Check size={14} strokeWidth={2} className="shrink-0 text-emerald-600" aria-label="Uploaded" />
                      ) : (
                        <X size={14} strokeWidth={2} className="shrink-0 text-red-600" aria-label="Not yet" />
                      )}
                      <span>{nameCase(r.fullName)}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
