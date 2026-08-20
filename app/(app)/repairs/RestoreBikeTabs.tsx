"use client";

import { useState } from "react";

// Arrival Listing and Bikes Listing are two different tables sharing this
// page — same tab-switched pattern as Claims' Warranty/Delivery split.
export default function RestoreBikeTabs({
  arrivalCount,
  bikesCount,
  arrival,
  bikes,
}: {
  arrivalCount: number;
  bikesCount: number;
  arrival: React.ReactNode;
  bikes: React.ReactNode;
}) {
  const [tab, setTab] = useState<"arrival" | "bikes">("arrival");

  return (
    <div>
      <div className="flex gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-6 max-w-md">
        <button
          onClick={() => setTab("arrival")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "arrival" ? "bg-white text-indigo-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          Arrival Listing ({arrivalCount})
        </button>
        <button
          onClick={() => setTab("bikes")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "bikes" ? "bg-white text-indigo-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          Bikes Listing ({bikesCount})
        </button>
      </div>
      <div className={tab === "arrival" ? "" : "hidden"}>{arrival}</div>
      <div className={tab === "bikes" ? "" : "hidden"}>{bikes}</div>
    </div>
  );
}
