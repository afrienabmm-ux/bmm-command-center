import { formatCurrency } from "@/lib/format";

type MechanicTotal = {
  fullName: string;
  shortCode: string;
  walkInRevenue: number;
  packageRevenue: number;
  totalRevenue: number;
};

// Same idea as JobsheetRevenueSummary — a small table alongside the full
// month-by-month list, built entirely from the same rows already fetched
// for the report rather than a separate query.
export default function MechanicRevenueSummary({ mechanics }: { mechanics: MechanicTotal[] }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-800 mb-3">Total Revenue by Mechanic (last 12 months)</p>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto max-w-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <th className="px-4 py-2.5">Mechanic</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5 text-right">Walk-in</th>
              <th className="px-4 py-2.5 text-right">Services Combo</th>
              <th className="px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {mechanics.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-neutral-500">
                  No data yet.
                </td>
              </tr>
            ) : (
              mechanics.map((m) => (
                <tr key={m.shortCode} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">{m.fullName}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">{m.shortCode}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-700">{formatCurrency(m.walkInRevenue)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-700">{formatCurrency(m.packageRevenue)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-900 font-medium">{formatCurrency(m.totalRevenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
