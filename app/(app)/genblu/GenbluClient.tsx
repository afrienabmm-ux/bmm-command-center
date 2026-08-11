"use client";

import { useState, useTransition } from "react";
import { Plus, ImageIcon, Download, X, Pencil, Trash2 } from "lucide-react";
import { addGenbluRegistrationAction, updateGenbluRegistrationAction, deleteGenbluRegistrationAction } from "@/lib/genblu-actions";
import { exportGenbluCsv, exportAllBranchesGenbluCsv } from "@/lib/export-actions";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate } from "@/lib/format";
import type { Mechanic } from "@/lib/types";

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
  mechanics,
  branch,
  branchSelection,
  locked,
}: {
  registrations: RegWithUrl[];
  mechanics: Mechanic[];
  branch: Branch;
  branchSelection: BranchSelection;
  locked: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RegWithUrl | null>(null);
  const [deleting, setDeleting] = useState<RegWithUrl | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleExport() {
    setExporting(true);
    try {
      const showAllBranches = branchSelection === "all";
      const csv = showAllBranches
        ? await exportAllBranchesGenbluCsv(fromDate || undefined, toDate || undefined)
        : await exportGenbluCsv(branch, fromDate || undefined, toDate || undefined);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = fromDate || toDate ? `-${fromDate || "start"}_${toDate || "end"}` : "";
      a.download = `bmm-genblu-${showAllBranches ? "all" : branch}${suffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      await deleteGenbluRegistrationAction(deleting.id, deleting.branch);
      setDeleting(null);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-500">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
          />
          <label className="text-xs font-medium text-neutral-500">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Download size={15} /> {exporting ? "Exporting…" : "Export to Excel / CSV"}
        </button>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={15} /> New Registration
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {registrations.map((r) => (
          <div key={r.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div
              className="aspect-video bg-neutral-50 flex items-center justify-center cursor-pointer"
              onDoubleClick={() => r.screenshotUrl && setLightboxUrl(r.screenshotUrl)}
              title={r.screenshotUrl ? "Double-click to view full size" : undefined}
            >
              {r.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.screenshotUrl} alt="GenBlu screenshot" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} className="text-neutral-700" />
              )}
            </div>
            <div className="p-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-800">
                  {r.salespersonName} {r.salespersonCode && <span className="text-neutral-500">({r.salespersonCode})</span>}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">Plate: {r.customerPlateNo}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {formatDate(r.createdAt)} · {branchLabel(r.branch)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(r)}
                  className="text-neutral-400 hover:text-indigo-600 transition-colors p-1"
                  title="Edit registration"
                  aria-label="Edit registration"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleting(r)}
                  className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                  title="Delete registration"
                  aria-label="Delete registration"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {registrations.length === 0 && (
          <p className="text-sm text-neutral-500 col-span-full text-center py-10">No GenBlu registrations yet.</p>
        )}
      </div>

      {modalOpen && (
        <RegisterModal branch={branch} locked={locked} mechanics={mechanics} onClose={() => setModalOpen(false)} />
      )}

      {editing && (
        <EditModal registration={editing} mechanics={mechanics} onClose={() => setEditing(null)} />
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete this registration?</h2>
            <p className="text-sm text-neutral-600 mb-6">
              <span className="text-neutral-800 font-medium">{deleting.salespersonName}</span>&apos;s registration for
              plate <span className="text-neutral-800 font-medium">{deleting.customerPlateNo}</span> will be
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

      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 px-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-5 right-5 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="GenBlu screenshot full size" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

function RegisterModal({
  branch,
  locked,
  mechanics,
  onClose,
}: {
  branch: Branch;
  locked: boolean;
  mechanics: Mechanic[];
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [regBranch, setRegBranch] = useState<Branch>(branch);
  const branchMechanics = mechanics.filter((m) => m.branch === regBranch);
  const [salespersonId, setSalespersonId] = useState(branchMechanics[0]?.id ?? "custom");

  const selectedMechanic = branchMechanics.find((m) => m.id === salespersonId) ?? null;

  function handleBranchChange(next: Branch) {
    setRegBranch(next);
    const nextMechanics = mechanics.filter((m) => m.branch === next);
    setSalespersonId(nextMechanics[0]?.id ?? "custom");
  }

  function handleSubmit(formData: FormData) {
    if (selectedMechanic) {
      formData.set("salesperson_name", selectedMechanic.shortName);
      formData.set("salesperson_code", selectedMechanic.shortCode);
    }
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
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Salesperson Name *</label>
            {branchMechanics.length > 0 ? (
              <select
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              >
                {branchMechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.shortName} ({m.shortCode})
                  </option>
                ))}
                <option value="custom">Other (type manually)</option>
              </select>
            ) : (
              <input
                type="text"
                name="salesperson_name"
                required
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            )}
          </div>

          {(branchMechanics.length === 0 || salespersonId === "custom") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Name</label>
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
          )}

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
              value={regBranch}
              onChange={(e) => handleBranchChange(e.target.value as Branch)}
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

function EditModal({
  registration,
  mechanics,
  onClose,
}: {
  registration: RegWithUrl;
  mechanics: Mechanic[];
  onClose: () => void;
}) {
  const branchMechanics = mechanics.filter((m) => m.branch === registration.branch);
  const matchingMechanic = branchMechanics.find(
    (m) => m.shortName === registration.salespersonName && m.shortCode === registration.salespersonCode
  );
  const [salespersonId, setSalespersonId] = useState(matchingMechanic?.id ?? "custom");
  const [salespersonName, setSalespersonName] = useState(registration.salespersonName);
  const [salespersonCode, setSalespersonCode] = useState(registration.salespersonCode);
  const [plateNo, setPlateNo] = useState(registration.customerPlateNo);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleMechanicChange(id: string) {
    setSalespersonId(id);
    const m = branchMechanics.find((m) => m.id === id);
    if (m) {
      setSalespersonName(m.shortName);
      setSalespersonCode(m.shortCode);
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateGenbluRegistrationAction(registration.id, registration.branch, {
        salespersonName,
        salespersonCode,
        customerPlateNo: plateNo,
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
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Edit GenBlu Registration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Salesperson Name *</label>
            {branchMechanics.length > 0 ? (
              <select
                value={salespersonId}
                onChange={(e) => handleMechanicChange(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              >
                {branchMechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.shortName} ({m.shortCode})
                  </option>
                ))}
                <option value="custom">Other (type manually)</option>
              </select>
            ) : null}
          </div>

          {(branchMechanics.length === 0 || salespersonId === "custom") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Name</label>
                <input
                  type="text"
                  value={salespersonName}
                  onChange={(e) => setSalespersonName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Code</label>
                <input
                  type="text"
                  value={salespersonCode}
                  onChange={(e) => setSalespersonCode(e.target.value)}
                  placeholder="e.g. NJ"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Plate No. *</label>
            <input
              type="text"
              value={plateNo}
              onChange={(e) => setPlateNo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
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
            disabled={isPending || !salespersonName.trim() || !plateNo.trim()}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
