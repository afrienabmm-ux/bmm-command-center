"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Download } from "lucide-react";
import { setMonthlyTargetAction } from "@/lib/targets-actions";
import { exportYearlySummaryCsv } from "@/lib/export-actions";
import { formatCurrency, monthLabel } from "@/lib/format";
import type { BranchMonthSummary } from "@/lib/reports-actions";
import type { Branch } from "@/lib/branch";

export default function CommandCenterClient({
  summary,
  isAdmin,
  branch,
}: {
  summary: BranchMonthSummary;
  isAdmin: boolean;
  branch: Branch;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(summary.targetAmount || ""));
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  const pct =
    summary.targetAmount > 0 ? Math.min(100, Math.round((summary.achievedAmount / summary.targetAmount) * 100)) : 0;

  const prevMonth = summary.month === 1 ? 12 : summary.month - 1;
  const prevYear = summary.month === 1 ? summary.year - 1 : summary.year;
  const nextMonth = summary.month === 12 ? 1 : summary.month + 1;
  const nextYear = summary.month === 12 ? summary.year + 1 : summary.year;

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportYearlySummaryCsv(branch, summary.year);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bmm-targets-${branch}-${summary.year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleSave() {
    const value = Number(amount);
    if (Number.isNaN(value) || value < 0) return;
    startTransition(async () => {
      await setMonthlyTargetAction(branch, summary.year, summary.month, value);
      setEditing(false);
    });
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-600 mb-1">
            <Link href={`/?year=${prevYear}&month=${prevMonth}`} className="hover:text-neutral-800">
              <ChevronLeft size={14} />
            </Link>
            <span>{monthLabel(summary.month, summary.year)} Target</span>
            <Link href={`/?year=${nextYear}&month=${nextMonth}`} className="hover:text-neutral-800">
              <ChevronRight size={14} />
            </Link>
          </div>
          <p className="text-3xl font-semibold text-neutral-900">{formatCurrency(summary.targetAmount)}</p>
          <p className="text-sm text-neutral-600 mt-1">
            {formatCurrency(summary.achievedAmount)} achieved ({pct}%)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Pencil size={13} /> Edit Target
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-800 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Download size={13} /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="mt-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">
              Set {monthLabel(summary.month, summary.year)} Target
            </h2>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Target Amount (RM)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 mb-6"
            />
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
    </div>
  );
}
