"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Download, Trash2 } from "lucide-react";
import { addWarrantyClaimAction, updateClaimStatusAction, updateClaimStockStatusAction, deleteClaimAction } from "@/lib/claims-actions";
import { exportWarrantyClaimsCsv } from "@/lib/export-actions";
import { CLAIM_STATUSES, STOCK_STATUSES, type ClaimStatus, type StockStatus, type WarrantyClaim } from "@/lib/types";
import type { Branch } from "@/lib/branch";
import { formatDate } from "@/lib/format";

const STATUS_STYLES: Record<ClaimStatus, string> = {
  Pending: "bg-neutral-100 text-neutral-700 border-neutral-300",
  "In Progress": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

const STOCK_STYLES: Record<StockStatus, string> = {
  "In Stock": "bg-sky-500/10 text-sky-700 border-sky-500/20",
  Sold: "bg-purple-500/10 text-purple-700 border-purple-500/20",
};

export default function ClaimsClient({ claims, branch }: { claims: WarrantyClaim[]; branch: Branch }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "All">("All");
  const [exporting, setExporting] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return claims.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.customerName, c.plateNo, c.ticketId, c.status].some((f) => f.toLowerCase().includes(q));
    });
  }, [claims, query, statusFilter]);

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportWarrantyClaimsCsv(branch, statusFilter === "All" ? undefined : statusFilter);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = statusFilter === "All" ? "" : `-${statusFilter.toLowerCase().replace(/\s+/g, "-")}`;
      a.download = `bmm-warranty-claims-${branch}${suffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, plate no, ticket ID, status…"
            className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 w-72"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | "All")}
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="All">All Statuses</option>
            {CLAIM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download size={15} /> {exporting ? "Exporting…" : "Export to Excel / CSV"}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Claim
          </button>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th className="font-medium px-5 py-3 whitespace-nowrap">Ticket ID</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Customer</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Plate No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Model</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Phone</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Issue</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Stock</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Submitted</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <ClaimRow key={c.id} claim={c} branch={branch} />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    {claims.length === 0 ? "No warranty claims yet." : "No claims match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <AddClaimModal branch={branch} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function ClaimRow({ claim, branch }: { claim: WarrantyClaim; branch: Branch }) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleDelete() {
    setDeleting(true);
    startTransition(async () => {
      await deleteClaimAction(claim.id, branch);
      setDeleting(false);
      setConfirmOpen(false);
    });
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-900 font-semibold whitespace-nowrap">{claim.ticketId}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{claim.customerName}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.plateNo}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.model || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.phone || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 max-w-xs truncate">{claim.description}</td>
      <td className="px-5 py-3.5">
        <select
          value={claim.stockStatus}
          disabled={isPending}
          onChange={(e) =>
            startTransition(() => updateClaimStockStatusAction(claim.id, branch, e.target.value as StockStatus))
          }
          className={`text-xs font-medium px-2.5 py-1.5 rounded-full border focus:outline-none disabled:opacity-50 ${STOCK_STYLES[claim.stockStatus]}`}
        >
          {STOCK_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-white text-neutral-800">
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{formatDate(claim.submittedDate)}</td>
      <td className="px-5 py-3.5">
        <select
          value={claim.status}
          disabled={isPending}
          onChange={(e) =>
            startTransition(() => updateClaimStatusAction(claim.id, branch, e.target.value as ClaimStatus))
          }
          className={`text-xs font-medium px-2.5 py-1.5 rounded-full border focus:outline-none disabled:opacity-50 ${STATUS_STYLES[claim.status]}`}
        >
          {CLAIM_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-white text-neutral-800">
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <button
          onClick={() => setConfirmOpen(true)}
          className="text-neutral-400 hover:text-red-600 transition-colors p-1"
          title="Delete claim"
          aria-label="Delete claim"
        >
          <Trash2 size={15} />
        </button>

        {confirmOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 text-left">
              <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete this claim?</h2>
              <p className="text-sm text-neutral-600 mb-6">
                Ticket <span className="text-neutral-800 font-medium">{claim.ticketId}</span> for{" "}
                <span className="text-neutral-800 font-medium">{claim.customerName}</span> will be permanently
                removed. This can&apos;t be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || isPending}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function AddClaimModal({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const [ticketId, setTicketId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [model, setModel] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [stockStatus, setStockStatus] = useState<StockStatus>("In Stock");
  const [submittedDate, setSubmittedDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSave = ticketId.trim() !== "" && customerName.trim() !== "" && plateNo.trim() !== "" && description.trim() !== "";

  function handleSave() {
    if (!canSave) {
      setError("Ticket ID, customer name, plate number, and the issue description are all required.");
      return;
    }
    startTransition(async () => {
      const result = await addWarrantyClaimAction({
        branch,
        ticketId: ticketId.trim(),
        customerName: customerName.trim(),
        plateNo: plateNo.trim(),
        model: model.trim(),
        phone: phone.trim(),
        description: description.trim(),
        stockStatus,
        submittedDate,
      });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Add Warranty Claim</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Ticket ID *</label>
            <input
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. 001-00-046862"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Plate No. *</label>
              <input
                type="text"
                value={plateNo}
                onChange={(e) => setPlateNo(e.target.value)}
                placeholder="e.g. WXX 1234"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Y15ZR"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone No.</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="012-345 6789"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Issue / Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's the claim about?"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Stock Status</label>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value as StockStatus)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              >
                {STOCK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Submitted Date</label>
              <input
                type="date"
                value={submittedDate}
                onChange={(e) => setSubmittedDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-700 mt-4">{error}</p>}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add Claim
          </button>
        </div>
      </div>
    </div>
  );
}
