"use client";

import { useState, useTransition } from "react";
import { Plus, ImageIcon } from "lucide-react";
import { addGenbluRegistrationAction } from "@/lib/genblu-actions";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { formatDate } from "@/lib/format";

type RegWithUrl = {
  id: string;
  branch: Branch;
  salespersonName: string;
  salespersonCode: string;
  customerPlateNo: string;
  screenshotUrl: string | null;
  createdAt: string;
};

export default function GenbluClient({
  registrations,
  branch,
  locked,
}: {
  registrations: RegWithUrl[];
  branch: Branch;
  locked: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> New Registration
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {registrations.map((r) => (
          <div key={r.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="aspect-video bg-neutral-50 flex items-center justify-center">
              {r.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.screenshotUrl} alt="GenBlu screenshot" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} className="text-neutral-700" />
              )}
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-neutral-800">
                {r.salespersonName} {r.salespersonCode && <span className="text-neutral-500">({r.salespersonCode})</span>}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">Plate: {r.customerPlateNo}</p>
              <p className="text-xs text-neutral-400 mt-1">
                {formatDate(r.createdAt)} · {branchLabel(r.branch)}
              </p>
            </div>
          </div>
        ))}
        {registrations.length === 0 && (
          <p className="text-sm text-neutral-500 col-span-full text-center py-10">No GenBlu registrations yet.</p>
        )}
      </div>

      {modalOpen && <RegisterModal branch={branch} locked={locked} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function RegisterModal({ branch, locked, onClose }: { branch: Branch; locked: boolean; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addGenbluRegistrationAction(formData);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">New GenBlu Registration</h2>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Salesperson Name *</label>
              <input
                type="text"
                name="salesperson_name"
                required
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Code</label>
              <input
                type="text"
                name="salesperson_code"
                placeholder="e.g. NJ"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Plate No. *</label>
            <input
              type="text"
              name="customer_plate_no"
              required
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
            <select
              name="branch"
              defaultValue={branch}
              disabled={locked}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Screenshot</label>
            <input
              type="file"
              name="screenshot"
              accept="image/*"
              className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {isPending ? "Saving…" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
