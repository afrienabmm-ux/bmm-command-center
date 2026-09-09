"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PackageBreakdownRow } from "@/lib/dashboard-breakdowns-actions";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { formatDate } from "@/lib/format";

// How many rows show before the list collapses behind "View All" — this
// section can easily run to 15-20+ rows in a busy month, which pushed
// everything below it (the mechanic table, claims) far down the page just
// to show combo sales nobody was actively looking for.
const COLLAPSED_COUNT = 5;

// Plain list of Services Combo sales — which package, which mechanic sold
// it, for which customer. Replaces the old pie-chart breakdown; a list is
// what's actually useful when you want to check who sold what, not just
// how the mix splits.
export default function PackageBreakdownCharts({
  packageBreakdown,
  onlyBranch,
}: {
  packageBreakdown: Record<Branch, PackageBreakdownRow[]>;
  onlyBranch?: Branch;
}) {
  const [showAll, setShowAll] = useState(false);
  const comboBranches = onlyBranch ? BRANCHES.filter((b) => b.value === onlyBranch) : BRANCHES;
  const allRows = comboBranches.flatMap(({ value: branch }) =>
    (packageBreakdown[branch] ?? []).map((row) => ({ ...row, branch }))
  );
  const totalSold = allRows.length;
  const visibleRows = showAll ? allRows : allRows.slice(0, COLLAPSED_COUNT);
  const hiddenCount = totalSold - visibleRows.length;

  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900 mb-3">
        {onlyBranch ? "Services Combo Sold" : "Services Combo Sold by Branch"} ({totalSold})
      </p>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <th className="px-4 py-2.5">Package</th>
              <th className="px-4 py-2.5">Jobsheet No</th>
              <th className="px-4 py-2.5">Mechanic</th>
              <th className="px-4 py-2.5">Customer</th>
              {!onlyBranch && <th className="px-4 py-2.5">Branch</th>}
              <th className="px-4 py-2.5">Date</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={`${row.branch}-${i}`} className="border-t border-neutral-100">
                <td className="px-4 py-2.5 text-neutral-800 font-medium">{row.packageName}</td>
                <td className="px-4 py-2.5 text-neutral-700">{row.receiptId}</td>
                <td className="px-4 py-2.5 text-neutral-700">{row.mechanicLabel}</td>
                <td className="px-4 py-2.5 text-neutral-600">{row.customerName}</td>
                {!onlyBranch && <td className="px-4 py-2.5 text-neutral-600">{branchLabel(row.branch)}</td>}
                <td className="px-4 py-2.5 text-neutral-500">{formatDate(row.saleDate)}</td>
              </tr>
            ))}
            {totalSold === 0 && (
              <tr>
                <td colSpan={onlyBranch ? 5 : 6} className="px-4 py-8 text-center text-neutral-500">
                  No Services Combo sold this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {totalSold > COLLAPSED_COUNT && (
          <div className="px-4 py-3 border-t border-neutral-100">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              {showAll ? (
                <>
                  <ChevronUp size={15} /> Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={15} /> View All ({hiddenCount} more)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
