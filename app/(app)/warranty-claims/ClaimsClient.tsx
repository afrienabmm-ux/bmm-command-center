"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addWarrantyClaimAction, updateClaimStatusAction } from "@/lib/claims-actions";
import { CLAIM_STATUSES, type ClaimStatus, type WarrantyClaim } from "@/lib/types";
import type { Branch } from "@/lib/branch";
import { formatDate } from "@/lib/format";

const STATUS_STYLES: Record<ClaimStatus, string> = {
  Submitted: "bg-neutral-100 text-neutral-700 border-neutral-300",
  Approved: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Rejected: "bg-red-500/10 text-red-700 border-red-500/20",
  Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

export default function ClaimsClient({ claims, branch }: { claims: WarrantyClaim[]; branch: Branch }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Claim
        </button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th className="font-medium px-5 py-3 whitespace-nowrap">Claim No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Customer</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Plate No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Description</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Submitted</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <ClaimRow key={c.id} claim={c} branch={branch} />
              ))}
              {claims.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    No warranty claims yet.
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

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">{claim.claimNo}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{claim.customerName}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.plateNo}</td>
      <td className="px-5 py-3.5 text-neutral-600 max-w-xs truncate">{claim.description}</td>
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
    </tr>
  );
}

function AddClaimModal({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const [customerName, setCustomerName] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [description, setDescription] = useState("");
  const [submittedDate, setSubmittedDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();

  const canSave = customerName.trim() !== "" && plateNo.trim() !== "";

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await addWarrantyClaimAction({
        branch,
        customerName: customerName.trim(),
        plateNo: plateNo.trim(),
        description: description.trim(),
        submittedDate,
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Add Warranty Claim</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's the claim about?"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
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
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || isPending}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add Claim
          </button>
        </div>
      </div>
    </div>
  );
}
