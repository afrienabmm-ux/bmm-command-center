import { formatCurrency } from "@/lib/format";

type PeriodRow = { label: string; total: number; byBranch?: Record<string, number> };

// Same idea as GenBlu's Monthly Point Allocation Summary — a small table
// alongside the full transaction list, built entirely from the same rows
// already fetched for the report rather than a separate query.
export default function JobsheetRevenueSummary({
  weeks,
  months,
  branches,
  branchColumns,
}: {
  weeks: PeriodRow[];
  months: PeriodRow[];
  branches?: { label: string; jobs: number; revenue: number }[];
  // Present only on the combined All Branches view — one column per
  // branch (keyed to match byBranch above) plus the existing Total.
  branchColumns?: { key: string; label: string }[];
}) {
  function renderPeriodTable(title: string, rows: PeriodRow[], periodLabel: string) {
    const colCount = 2 + (branchColumns?.length ?? 0);
    return (
      <div>
        <p className="text-xs font-medium text-neutral-800 mb-2">{title}</p>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto max-w-full">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-50 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-2.5 py-1.5 whitespace-nowrap">{periodLabel}</th>
                {branchColumns?.map((b) => (
                  <th key={b.key} className="px-2.5 py-1.5 text-right whitespace-nowrap">
                    {b.label}
                  </th>
                ))}
                <th className="px-2.5 py-1.5 text-right whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-2.5 py-4 text-center text-neutral-500">
                    No data yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.label} className="border-t border-neutral-100">
                    <td className="px-2.5 py-1.5 text-neutral-700 whitespace-nowrap">{r.label}</td>
                    {branchColumns?.map((b) => (
                      <td key={b.key} className="px-2.5 py-1.5 text-right text-neutral-700 whitespace-nowrap">
                        {formatCurrency(r.byBranch?.[b.key] ?? 0)}
                      </td>
                    ))}
                    <td className="px-2.5 py-1.5 text-right text-neutral-900 font-medium whitespace-nowrap">
                      {formatCurrency(r.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {branches && (
        <div>
          <p className="text-sm font-medium text-neutral-800 mb-3">Jobsheet Summary by Branch</p>
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden max-w-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Branch</th>
                  <th className="px-4 py-2.5 text-right">Jobs</th>
                  <th className="px-4 py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => {
                  const isTotal = b.label === "All Branches";
                  return (
                    <tr
                      key={b.label}
                      className={`border-t border-neutral-100 ${isTotal ? "bg-emerald-50 font-semibold text-emerald-900" : ""}`}
                    >
                      <td className={`px-4 py-2.5 whitespace-nowrap ${isTotal ? "" : "text-neutral-700"}`}>{b.label}</td>
                      <td className={`px-4 py-2.5 text-right whitespace-nowrap ${isTotal ? "" : "text-neutral-800"}`}>{b.jobs}</td>
                      <td className={`px-4 py-2.5 text-right whitespace-nowrap ${isTotal ? "" : "text-neutral-800 font-medium"}`}>
                        {formatCurrency(b.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {renderPeriodTable("Revenue by Week", weeks, "Week")}
      {renderPeriodTable("Revenue by Month", months, "Month")}
    </div>
  );
}
