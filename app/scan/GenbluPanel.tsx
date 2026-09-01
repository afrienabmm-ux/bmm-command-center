"use client";

import { useState } from "react";
import GenbluQuickForm, { type RecentJobsheetCustomer } from "./GenbluQuickForm";
import GenbluTransactionForm from "./GenbluTransactionForm";
import type { BranchSelection } from "@/lib/branch";

// Two different GenBlu tasks share this tab: linking a screenshot to an
// existing jobsheet customer (enrollment), and logging a points award read
// straight off the app (for the monthly counts/points totals) — separate
// enough purposes, with separate effects on the Tracker, that they get
// their own sub-toggle rather than one form trying to do both.
export default function GenbluPanel({
  recentJobs,
  branchSelection,
  defaultMode = "log",
}: {
  recentJobs: RecentJobsheetCustomer[];
  branchSelection: BranchSelection;
  defaultMode?: "link" | "log";
}) {
  const [mode, setMode] = useState<"link" | "log">(defaultMode);

  return (
    <div>
      <div className="flex gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-4">
        <button
          onClick={() => setMode("link")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === "link" ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          GenBlu Register
        </button>
        <button
          onClick={() => setMode("log")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === "log" ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          Point Allocation
        </button>
      </div>
      {mode === "log" ? (
        <GenbluTransactionForm branchSelection={branchSelection} />
      ) : (
        <GenbluQuickForm recentJobs={recentJobs} branchSelection={branchSelection} />
      )}
    </div>
  );
}
