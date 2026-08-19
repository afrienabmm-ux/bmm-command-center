"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { setMonthlyTargetAction } from "@/lib/targets-actions";
import { formatCurrency, monthLabel } from "@/lib/format";
import { BRANCHES, type Branch } from "@/lib/branch";

export default function CombinedTargetEditor({
  year,
  month,
  branchTargets,
}: {
  year: number;
  month: number;
  branchTargets: Record<Branch, number>;
}) {
  const [editing, setEditing] = useState(false);
  const [amounts, setAmounts] = useState<Record<Branch, string>>(() =>
    BRANCHES.reduce((acc, b) => ({ ...acc, [b.value]: String(branchTargets[b.value] || "") }), {} as Record<Branch, string>)
  );
  const [isPending, startTransition] = useTransition();

  const combinedTotal = BRANCHES.reduce((sum, b) => sum + (Number(amounts[b.value]) || 0), 0);

  function handleSave() {
    const values = BRANCHES.map((b) => ({ branch: b.value, value: Number(amounts[b.value]) }));
    if (values.some((v) => Number.isNaN(v.value) || v.value < 0)) return;
    startTransition(async () => {
      await Promise.all(values.map(({ branch, value }) => setMonthlyTargetAction(branch, year, month, value)));
      setEditing(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Pencil size={13} /> Edit Branch Targets
      </button>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-1">Set {monthLabel(month, year)} Targets</h2>
            <p className="text-xs text-neutral-500 mb-4">Each branch can have its own target — they don't need to match.</p>
            <div className="space-y-3">
              {BRANCHES.map((b) => (
                <div key={b.value}>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">{b.label} Target (RM)</label>
                  <input
                    type="number"
                    value={amounts[b.value]}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [b.value]: e.target.value }))}
                    min={0}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-4 mb-6">Combined total: {formatCurrency(combinedTotal)}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEditing(false)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
