import { branchLabel } from "@/lib/branch";
import { formatDate } from "@/lib/format";
import type { GenbluTransaction } from "@/lib/types";

// The detail list behind the Monthly Point Allocation Summary above —
// same columns as the admin's own spreadsheet (No, Transaction Date, Time,
// Points, Category, Customer Name, Branch), built entirely from what OCR
// read off each screenshot.
export default function GenbluTransactionsList({
  transactions,
  showBranch,
}: {
  transactions: GenbluTransaction[];
  showBranch: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-800 mb-3">Point Allocation Transactions ({transactions.length})</p>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">No</th>
                <th className="px-4 py-2.5">Transaction Date</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5 text-right">Points</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Customer Name</th>
                <th className="px-4 py-2.5">Membership No.</th>
                {showBranch && <th className="px-4 py-2.5">Branch</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={t.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 text-neutral-500">{i + 1}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{t.transactionDate ? formatDate(t.transactionDate) : "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{t.transactionTime ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-neutral-800 font-medium">{t.points}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{t.productCategory ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-800 font-medium">{t.customerName}</td>
                  <td className="px-4 py-2.5 text-neutral-500">{t.membershipNumber ?? "—"}</td>
                  {showBranch && <td className="px-4 py-2.5 text-neutral-600">{branchLabel(t.branch)}</td>}
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={showBranch ? 8 : 7} className="px-4 py-8 text-center text-neutral-500">
                    No point allocation transactions logged this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
