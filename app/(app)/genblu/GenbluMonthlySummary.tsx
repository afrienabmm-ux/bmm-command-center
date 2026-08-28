import type { GenbluMonthlySummaryRow } from "@/lib/genblu-actions";

// Mirrors the admin's own spreadsheet "Finding" table exactly — how many
// points transactions were logged this month, and how many total points,
// split by branch. Built entirely from cc_genblu_transactions (the
// Point Allocation phone upload), never typed in by hand.
export default function GenbluMonthlySummary({
  summary,
}: {
  summary: { rows: GenbluMonthlySummaryRow[]; total: GenbluMonthlySummaryRow };
}) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-800 mb-3">Monthly Point Allocation Summary</p>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden max-w-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <th className="px-4 py-2.5">Branch</th>
              <th className="px-4 py-2.5 text-center">Counts</th>
              <th className="px-4 py-2.5 text-center">Points</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <tr key={r.branch} className="border-t border-neutral-100">
                <td className="px-4 py-2.5 text-neutral-700">{r.label}</td>
                <td className="px-4 py-2.5 text-center text-neutral-700">{r.counts}</td>
                <td className="px-4 py-2.5 text-center text-neutral-700">{r.points.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold text-neutral-900">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-center">{summary.total.counts}</td>
              <td className="px-4 py-2.5 text-center">{summary.total.points.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
