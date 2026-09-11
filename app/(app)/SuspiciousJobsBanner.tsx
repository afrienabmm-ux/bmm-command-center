"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { dismissSuspiciousJobAction, type SuspiciousJob } from "@/lib/repairs-actions";
import { branchLabel } from "@/lib/branch";

// Plain, explainable red flags on recent Walk-in jobs (see
// getSuspiciousWalkInJobs) — an unusually high cost, a missing Job Date,
// no mechanic assigned, or a missing customer name/plate. Not a verdict —
// just a shortlist worth a second look, same spirit as the Service
// Reminder banner right above it.
export default function SuspiciousJobsBanner({ jobs, showBranch }: { jobs: SuspiciousJob[]; showBranch: boolean }) {
  if (jobs.length === 0) return null;

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
          <Link
            href={jobs.length === 1 ? `/repairs/walk-in?highlight=${jobs[0].id}` : "/repairs/walk-in"}
            className="inline-block text-xs font-medium text-amber-700 hover:text-amber-800 mt-2 underline"
            onClick={() => {
              if (jobs.length === 1) dismissSuspiciousJobAction(jobs[0].id);
            }}
          >
            View in Jobsheet
          </Link>
        </div>
      </div>
    </div>
  );
}
