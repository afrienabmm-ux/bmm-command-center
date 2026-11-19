"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";

// Two separate tools on one page, tab-switched instead of stacked — on a
// phone screen, scrolling past a whole jobsheet form just to reach the
// GenBlu upload (or vice versa) is more friction than it's worth.
//
// `remindGenbluAfterSave` is a soft nudge (not a hard block) for roles
// where the GenBlu step tends to get skipped — right after a jobsheet
// save (the "?saved=1" redirect WalkInJobForm does), this jumps straight
// to the GenBlu tab with a reminder banner instead of leaving them on the
// jobsheet tab with nothing pointing them at the next step.
export default function ScanTabs({
  jobsheet,
  genblu,
  remindGenbluAfterSave = false,
}: {
  jobsheet: React.ReactNode;
  genblu: React.ReactNode;
  remindGenbluAfterSave?: boolean;
}) {
  const searchParams = useSearchParams();
  const justSaved = searchParams.get("saved") === "1";
  const [tab, setTab] = useState<"jobsheet" | "genblu">(remindGenbluAfterSave && justSaved ? "genblu" : "jobsheet");

  return (
    <div>
      {remindGenbluAfterSave && justSaved && tab === "genblu" && (
        <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            Jobsheet saved. Now upload this customer&apos;s GenBlu points screenshot below.
          </p>
        </div>
      )}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab("jobsheet")}
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "jobsheet" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Scan jobsheet
        </button>
        <button
          onClick={() => setTab("genblu")}
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "genblu" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          GenBlu upload
        </button>
      </div>
      <div className={tab === "jobsheet" ? "" : "hidden"}>{jobsheet}</div>
      <div className={tab === "genblu" ? "" : "hidden"}>{genblu}</div>
    </div>
  );
}
