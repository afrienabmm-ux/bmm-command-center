"use client";

import { useState } from "react";

// GenBlu Register (customer enrollment) and Point Allocation (the monthly
// counts/points log) are two different tables sharing this page —
// tab-switched rather than stacked, same pattern as the Claims page.
export default function GenbluTabs({
  registeredCount,
  allocationCount,
  tracker,
  allocations,
}: {
  registeredCount: number;
  allocationCount: number;
  tracker: React.ReactNode;
  allocations: React.ReactNode;
}) {
  const [tab, setTab] = useState<"tracker" | "allocations">("tracker");

  return (
    <div>
      <div className="flex gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-6 max-w-md">
        <button
          onClick={() => setTab("tracker")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "tracker" ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          GenBlu Tracker ({registeredCount})
        </button>
        <button
          onClick={() => setTab("allocations")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "allocations" ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          GenBlu Allocations ({allocationCount})
        </button>
      </div>
      <div className={tab === "tracker" ? "" : "hidden"}>{tracker}</div>
      <div className={tab === "allocations" ? "" : "hidden"}>{allocations}</div>
    </div>
  );
}
