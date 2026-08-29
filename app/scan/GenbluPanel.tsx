"use client";

import GenbluTransactionForm, { type RecentJobsheetCustomer } from "./GenbluTransactionForm";
import type { BranchSelection } from "@/lib/branch";

// One upload, one form — the screenshot itself now both logs the points
// award and updates (or creates) the customer's Tracker registration, so
// there's no separate "GenBlu Register" step to keep in sync by hand.
export default function GenbluPanel({
  branchSelection,
  recentJobs,
}: {
  branchSelection: BranchSelection;
  recentJobs: RecentJobsheetCustomer[];
}) {
  return <GenbluTransactionForm branchSelection={branchSelection} recentJobs={recentJobs} />;
}
