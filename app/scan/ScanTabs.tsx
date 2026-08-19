"use client";

import { useState } from "react";

// Two separate tools on one page, tab-switched instead of stacked — on a
// phone screen, scrolling past a whole jobsheet form just to reach the
// GenBlu upload (or vice versa) is more friction than it's worth.
export default function ScanTabs({ jobsheet, genblu }: { jobsheet: React.ReactNode; genblu: React.ReactNode }) {
  const [tab, setTab] = useState<"jobsheet" | "genblu">("jobsheet");

  return (
    <div>
      <div className="flex gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-4">
        <button
          onClick={() => setTab("jobsheet")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "jobsheet" ? "bg-white text-indigo-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          Scan Jobsheet
        </button>
        <button
          onClick={() => setTab("genblu")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "genblu" ? "bg-white text-indigo-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          GenBlu Upload
        </button>
      </div>
      <div className={tab === "jobsheet" ? "" : "hidden"}>{jobsheet}</div>
      <div className={tab === "genblu" ? "" : "hidden"}>{genblu}</div>
    </div>
  );
}
