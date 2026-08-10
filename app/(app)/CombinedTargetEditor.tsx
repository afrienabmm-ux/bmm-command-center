"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { setCombinedMonthlyTargetAction } from "@/lib/targets-actions";
import { formatCurrency, monthLabel } from "@/lib/format";

export default function CombinedTargetEditor({
  year,
  month,
  currentTotal,
}: {
  year: number;
  month: number;
  currentTotal: number;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(currentTotal || ""));
  const [isPending, startTransition] = useTransition();

  const perBranch = (Number(amount) || 0) / 3;

  function handleSave() {
    const value = Number(amount);
    if (Number.isNaN(value) || value < 0) return;
    startTransition(async () => {
      await setCombinedMonthlyTargetAction(year, month, value);
      setEditing(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Pencil size={13} /> Edit Combined Target
      </button>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-1">
              Set {monthLabel(month, year)} Target — All Branches
            </h2>
            <p className="text-xs text-neutral-500 mb-4">
              This overall goal is split evenly across Kapar (HQ), Setia Alam, and Puncak Alam.
            </p>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Combined Target Amount (RM)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            <p className="text-xs text-neutral-500 mt-2 mb-6">
              → {formatCurrency(perBranch)} per branch
            </p>
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
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
