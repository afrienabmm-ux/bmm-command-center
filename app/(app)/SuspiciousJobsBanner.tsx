"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { dismissSuspiciousJobAction, type SuspiciousJob } from "@/lib/repairs-actions";
import { branchLabel } from "@/lib/branch";

// Plain, explainable red flags on recent Walk-in jobs (see
// getSuspiciousWalkInJobs) — an unusually high cost, a missing Job Date,
// no mechanic assigned, or a missing customer name/plate. Not a verdict —
// just a shortlist worth a second look, same spirit as the Service
// Reminder banner right above it.
export default function SuspiciousJobsBanner({ jobs, showBranch }: { jobs: SuspiciousJob[]; showBranch: boolean }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  if (jobs.length === 0) return null;

  function goToJob(job: SuspiciousJob) {
    setPickerOpen(false);
    dismissSuspiciousJobAction(job.id);
    router.push(`/repairs/walk-in?highlight=${job.id}`);
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
          <AlertTriangle size={17} className="text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-700">
            {jobs.length} jobsheet{jobs.length === 1 ? "" : "s"} worth a second look
          </p>
          <div className="mt-2 space-y-1.5">
            {jobs.slice(0, 6).map((j) => (
              <div key={j.id} className="text-xs text-amber-700">
                <Link
                  href={`/repairs/walk-in?highlight=${j.id}`}
                  className="font-medium hover:underline"
                  onClick={() => {
                    // Opening a specific flagged job counts as reviewing it —
                    // dismissed here so it doesn't keep reappearing on every
                    // future dashboard visit. Fired without awaiting: this is
                    // client-side navigation (no page unload), so the request
                    // still completes in the background.
                    dismissSuspiciousJobAction(j.id);
                  }}
                >
                  {j.jobNo || "(no job no.)"} — {j.customerName || j.plateNo || "Unnamed"}
                  {showBranch ? ` (${branchLabel(j.branch)})` : ""}
                </Link>
                <span className="text-amber-500"> — {j.reasons.join(", ")}</span>
              </div>
            ))}
            {jobs.length > 6 && <p className="text-[11px] text-amber-500">+{jobs.length - 6} more</p>}
          </div>
          {jobs.length === 1 ? (
            <Link
              href={`/repairs/walk-in?highlight=${jobs[0].id}`}
              className="inline-block text-xs font-medium text-amber-700 hover:text-amber-800 mt-2 underline"
              onClick={() => dismissSuspiciousJobAction(jobs[0].id)}
            >
              View in Jobsheet
            </Link>
          ) : (
            <div className="relative mt-2" ref={pickerRef}>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 underline"
              >
                View in Jobsheet
                <ChevronDown size={12} className={`transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
              </button>
              {pickerOpen && (
                <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-64">
                  <p className="px-3 py-1.5 text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
                    Which one?
                  </p>
                  {jobs.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => goToJob(j)}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                    >
                      {j.jobNo || "(no job no.)"} — {j.customerName || j.plateNo || "Unnamed"}
                      {showBranch ? ` (${branchLabel(j.branch)})` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
