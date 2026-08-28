import type { PackageBreakdownRow } from "@/lib/dashboard-breakdowns-actions";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { formatDate } from "@/lib/format";

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
  const comboBranches = onlyBranch ? BRANCHES.filter((b) => b.value === onlyBranch) : BRANCHES;
  const totalSold = comboBranches.reduce((sum, { value }) => sum + (packageBreakdown[value]?.length ?? 0), 0);

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
              <th className="px-4 py-2.5">Mechanic</th>
              <th className="px-4 py-2.5">Customer</th>
              {!onlyBranch && <th className="px-4 py-2.5">Branch</th>}
              <th className="px-4 py-2.5">Date</th>
            </tr>
          </thead>
          <tbody>
            {comboBranches.flatMap(({ value: branch }) =>
              (packageBreakdown[branch] ?? []).map((row, i) => (
                <tr key={`${branch}-${i}`} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 text-neutral-800 font-medium">{row.packageName}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{row.mechanicLabel}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{row.customerName}</td>
                  {!onlyBranch && <td className="px-4 py-2.5 text-neutral-600">{branchLabel(branch)}</td>}
                  <td className="px-4 py-2.5 text-neutral-500">{formatDate(row.saleDate)}</td>
                </tr>
              ))
            )}
            {totalSold === 0 && (
              <tr>
                <td colSpan={onlyBranch ? 4 : 5} className="px-4 py-8 text-center text-neutral-500">
                  No Services Combo sold this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
