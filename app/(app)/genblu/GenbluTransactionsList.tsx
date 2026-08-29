"use client";

import { useState, useTransition } from "react";
import { Download, Trash2, Check, X as XIcon } from "lucide-react";
import { deleteGenbluTransactionAction } from "@/lib/genblu-actions";
import { branchLabel } from "@/lib/branch";
import { formatDate, toCsv } from "@/lib/format";
import type { GenbluTransaction } from "@/lib/types";

// Same column order as the admin's own spreadsheet (No, Transaction Date,
// Time, Points, Categories, Remark, Customer Name, Service Coupon, Branch)
// — Remark isn't captured from the screenshot, so it exports blank rather
// than being dropped, to keep the layout identical. Service Coupon is the
// one field admin ticks by hand on the upload form.
const HEADERS = ["No", "Transaction Date", "Time", "Points", "Categories", "Remark", "Customer Name", "Service Coupon", "Branch"];

export default function GenbluTransactionsList({
  transactions,
  showBranch,
}: {
  transactions: GenbluTransaction[];
  showBranch: boolean;
}) {
  const [deleting, setDeleting] = useState<GenbluTransaction | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    const rows = transactions.map((t, i) => [
      i + 1,
      t.transactionDate ? formatDate(t.transactionDate) : "",
      t.transactionTime ?? "",
      t.points,
      t.productCategory ?? "",
      "",
      t.customerName,
      t.serviceCoupon ? "Yes" : "No",
      branchLabel(t.branch),
    ]);
    const csv = toCsv(HEADERS, rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bmm-genblu-point-allocation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      await deleteGenbluTransactionAction(deleting.id, deleting.branch);
      setDeleting(null);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-neutral-800">Point Allocation Transactions ({transactions.length})</p>
        <button
          onClick={handleExport}
          disabled={transactions.length === 0}
          className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-800 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
        >
          <Download size={14} /> Export to Report
        </button>
      </div>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">No</th>
                <th className="px-4 py-2.5">Transaction Date</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5 text-center">Points</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Customer Name</th>
                <th className="px-4 py-2.5">Membership No.</th>
                <th className="px-4 py-2.5 text-center">Coupon</th>
                {showBranch && <th className="px-4 py-2.5">Branch</th>}
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={t.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 text-neutral-500">{i + 1}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{t.transactionDate ? formatDate(t.transactionDate) : "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{t.transactionTime ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center text-neutral-800 font-medium">{t.points}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{t.productCategory ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-800 font-medium">{t.customerName}</td>
                  <td className="px-4 py-2.5 text-neutral-500">{t.membershipNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    {t.serviceCoupon ? (
                      <Check size={14} className="inline text-emerald-600" />
                    ) : (
                      <XIcon size={14} className="inline text-neutral-300" />
                    )}
                  </td>
                  {showBranch && <td className="px-4 py-2.5 text-neutral-600">{branchLabel(t.branch)}</td>}
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setDeleting(t)}
                      className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                      title="Delete transaction"
                      aria-label="Delete transaction"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={showBranch ? 10 : 9} className="px-4 py-8 text-center text-neutral-500">
                    No point allocation transactions logged this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete this transaction?</h2>
            <p className="text-sm text-neutral-600 mb-6">
              <span className="text-neutral-800 font-medium">{deleting.customerName}</span>&apos;s {deleting.points}-point
              allocation on {deleting.transactionDate ? formatDate(deleting.transactionDate) : "this date"} will be
              permanently removed. This can&apos;t be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
