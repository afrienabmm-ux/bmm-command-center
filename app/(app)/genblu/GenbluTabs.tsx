"use client";

import { useState } from "react";

// GenBlu Register (customer enrollment), New Registration (the
// brand-new-customer subset of it — shared out to the partner dashboard,
// see /api/genblu-new-registrations), and Point Allocation (the monthly
// counts/points log) — three different views over the data sharing this
// page, tab-switched rather than stacked, same pattern as the Claims page.
export default function GenbluTabs({
  registeredCount,
  newRegistrationCount,
  allocationCount,
  tracker,
  newRegistrations,
  allocations,
}: {
  registeredCount: number;
  newRegistrationCount: number;
  allocationCount: number;
  tracker: React.ReactNode;
  newRegistrations: React.ReactNode;
  allocations: React.ReactNode;
}) {
  const [tab, setTab] = useState<"tracker" | "newRegistrations" | "allocations">("tracker");

  return (
    <div>
      <div className="flex gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-6 max-w-xl">
        <button
          onClick={() => setTab("tracker")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "tracker" ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          GenBlu Tracker ({registeredCount})
        </button>
        <button
          onClick={() => setTab("newRegistrations")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "newRegistrations" ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          New Registration ({newRegistrationCount})
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
      <div className={tab === "newRegistrations" ? "" : "hidden"}>{newRegistrations}</div>
      <div className={tab === "allocations" ? "" : "hidden"}>{allocations}</div>
    </div>
  );
}
