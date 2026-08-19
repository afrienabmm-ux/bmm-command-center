"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { attachGenbluScreenshotAction } from "@/lib/genblu-actions";
import { branchLabel, type Branch } from "@/lib/branch";
import { formatDate } from "@/lib/format";

export type RecentJobsheetCustomer = {
  jobId: string;
  branch: Branch;
  customerName: string;
  customerPlateNo: string;
  date: string;
};

// Deliberately just a picker plus a file — the jobsheet form already
// collects the customer's name, plate, and branch, so re-typing them here
// would just be re-entering data that's already on file. Picking the
// jobsheet and reusing ensureGenbluRegistrationAction (the same action the
// jobsheet form's own "Customer has GenBlu?" toggle calls) keeps this in
// sync with that flow instead of being a second, divergent way to
// register someone.
export default function GenbluQuickForm({ recentJobs }: { recentJobs: RecentJobsheetCustomer[] }) {
  const [selectedId, setSelectedId] = useState(recentJobs[0]?.jobId ?? "");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selected = recentJobs.find((j) => j.jobId === selectedId) ?? null;

  function handleSubmit() {
    if (!selected) return;
    if (!screenshot) {
      setError("Pick a screenshot to upload.");
      return;
    }
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await attachGenbluScreenshotAction({
        branch: selected.branch,
        customerName: selected.customerName,
        customerPlateNo: selected.customerPlateNo,
        screenshot,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
      setScreenshot(null);
    });
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-neutral-900">Upload GenBlu Screenshot</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">Pick the customer's jobsheet, then upload their points screenshot.</p>

      {recentJobs.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-6">No recent jobsheets yet — add one under Scan Jobsheet first.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer / Jobsheet *</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              {recentJobs.map((j) => (
                <option key={j.jobId} value={j.jobId}>
                  {j.customerName || "—"} · {j.customerPlateNo} · {branchLabel(j.branch)} · {formatDate(j.date)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Points Screenshot *</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {done && !isPending && (
            <p className="text-sm text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Screenshot uploaded.
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !screenshot}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {isPending ? "Uploading…" : "Upload"}
          </button>
        </div>
      )}
    </div>
  );
}
