"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { addGenbluTransactionAction } from "@/lib/genblu-actions";
import { BRANCHES, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate } from "@/lib/format";
import type { GenbluTransaction } from "@/lib/types";

// Every field here is read straight off the screenshot by OCR — none of
// them are editable, on purpose (photo evidence, not typed numbers). Branch
// is the one field admin still picks, since it's never shown on the GenBlu
// app screen itself.
export default function GenbluTransactionForm({ branchSelection }: { branchSelection: BranchSelection }) {
  const [branch, setBranch] = useState<Branch>(branchSelection === "all" ? "kapar" : branchSelection);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenbluTransaction | null>(null);
  const [isPending, startTransition] = useTransition();
  const locked = branchSelection !== "all";

  function handleSubmit() {
    if (!screenshot) {
      setError("Pick a screenshot to upload.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addGenbluTransactionAction({ branch, screenshot });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res.transaction);
      setScreenshot(null);
    });
  }

  if (result) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5 mb-4">
          <CheckCircle2 size={16} /> Transaction logged
        </p>
        <div className="space-y-2.5 text-sm">
          <Field label="Customer" value={result.customerName} />
          <Field label="Membership No." value={result.membershipNumber ?? "—"} />
          <Field label="Category" value={result.productCategory ?? "—"} />
          <Field label="Points" value={String(result.points)} />
          <Field label="Date" value={result.transactionDate ? formatDate(result.transactionDate) : "—"} />
          <Field label="Time" value={result.transactionTime ?? "—"} />
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="w-full mt-5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          Log Another
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-neutral-900">Log Points Transaction</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">
        Photo the GenBlu app's transaction screen — customer, points, and date fill in automatically, nothing to type.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
          <div className="relative">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value as Branch)}
              disabled={locked}
              className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer disabled:opacity-60"
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Transaction Screenshot *</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !screenshot}
          className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {isPending ? "Reading screenshot…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-neutral-800 font-medium">{value}</span>
    </div>
  );
}
