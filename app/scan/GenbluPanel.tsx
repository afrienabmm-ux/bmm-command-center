"use client";

import GenbluTransactionForm from "./GenbluTransactionForm";
import type { BranchSelection } from "@/lib/branch";

// One upload, one form — the screenshot itself now both logs the points
// award and updates (or creates) the customer's Tracker registration, so
// there's no separate "GenBlu Register" step to keep in sync by hand.
export default function GenbluPanel({ branchSelection }: { branchSelection: BranchSelection }) {
  return <GenbluTransactionForm branchSelection={branchSelection} />;
}
