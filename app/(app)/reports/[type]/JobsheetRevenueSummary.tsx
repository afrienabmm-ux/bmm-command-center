import { formatCurrency } from "@/lib/format";

// Same idea as GenBlu's Monthly Point Allocation Summary — a small table
// alongside the full transaction list, built entirely from the same rows
// already fetched for the report rather than a separate query.
export default function JobsheetRevenueSummary({
  weeks,
  months,
  branches,
}: {
  weeks: { label: string; total: number }[];
  months: { label: string; total: number }[];
  branches?: { label: string; jobs: number; revenue: number }[];
}) {
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

      <div>
        <p className="text-sm font-medium text-neutral-800 mb-3">Revenue by Week</p>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden max-w-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Week</th>
                <th className="px-4 py-2.5 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {weeks.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-neutral-500">
                    No data yet.
                  </td>
                </tr>
              ) : (
                weeks.map((w) => (
                  <tr key={w.label} className="border-t border-neutral-100">
                    <td className="px-4 py-2.5 text-neutral-700 whitespace-nowrap">{w.label}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-800 font-medium whitespace-nowrap">
                      {formatCurrency(w.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-800 mb-3">Revenue by Month</p>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden max-w-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Month</th>
                <th className="px-4 py-2.5 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {months.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-neutral-500">
                    No data yet.
                  </td>
                </tr>
              ) : (
                months.map((m) => (
                  <tr key={m.label} className="border-t border-neutral-100">
                    <td className="px-4 py-2.5 text-neutral-700 whitespace-nowrap">{m.label}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-800 font-medium whitespace-nowrap">
                      {formatCurrency(m.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
