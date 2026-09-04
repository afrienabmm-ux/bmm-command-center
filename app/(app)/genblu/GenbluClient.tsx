"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Download, X, Pencil, Trash2, Search, Award, ChevronDown, MessageSquareWarning } from "lucide-react";
import { addGenbluRegistrationAction, updateGenbluRegistrationAction, deleteGenbluRegistrationAction } from "@/lib/genblu-actions";
import { exportGenbluCsv, exportAllBranchesGenbluCsv } from "@/lib/export-actions";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate, formatCurrency } from "@/lib/format";
import type { Mechanic } from "@/lib/types";
import ModalPortal from "@/components/ModalPortal";

type RegWithUrl = {
  id: string;
  branch: Branch;
  salespersonName: string;
  salespersonCode: string;
  customerName: string;
  customerPlateNo: string;
  screenshotUrl: string | null;
  createdAt: string;
  points: number;
  pointsAreActual: boolean;
  source: "new_customer" | "has_jobsheet";
  nameMismatchRemark: string | null;
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
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "new_customer" | "has_jobsheet">("all");
  const [isPending, startTransition] = useTransition();
  const [openRemarkId, setOpenRemarkId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrations.filter((r) => {
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (q && !r.customerName.toLowerCase().includes(q) && !r.customerPlateNo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [registrations, query, sourceFilter]);

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
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name or plate…"
            className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-64"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as "all" | "new_customer" | "has_jobsheet")}
            className="appearance-none bg-white border border-neutral-200 hover:border-red-300 rounded-lg pl-3.5 pr-9 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
          >
            <option value="all">All Registrations</option>
            <option value="new_customer">New Registration</option>
            <option value="has_jobsheet">Has Jobsheet</option>
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-500">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
          />
          <label className="text-xs font-medium text-neutral-500">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
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
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={15} /> New Registration
        </button>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Customer Name</th>
                <th className="px-4 py-2.5">Plate No.</th>
                <th className="px-4 py-2.5">Registered By</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Branch</th>
                <th className="px-4 py-2.5">Points</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-neutral-100 ${r.screenshotUrl ? "cursor-pointer hover:bg-neutral-50" : ""}`}
                  onDoubleClick={() => r.screenshotUrl && setLightboxUrl(r.screenshotUrl)}
                  title={r.screenshotUrl ? "Double-click to view the uploaded screenshot" : undefined}
                >
                  <td className="px-4 py-2.5 text-neutral-800 font-medium">
                    <span className="relative inline-flex items-center gap-1.5">
                      {r.customerName || "—"}
                      {r.nameMismatchRemark && (
                        <>
                          <button
                            type="button"
                            onClick={() => setOpenRemarkId((cur) => (cur === r.id ? null : r.id))}
                            className="shrink-0"
                          >
                            <MessageSquareWarning size={13} className="text-amber-500 shrink-0" />
                          </button>
                          {openRemarkId === r.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenRemarkId(null)} />
                              <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-normal text-amber-800 shadow-lg">
                                <div className="font-semibold text-amber-900 mb-0.5">Name mismatch note</div>
                                {r.nameMismatchRemark}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-700">{r.customerPlateNo}</td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {r.salespersonName} {r.salespersonCode && `(${r.salespersonCode})`}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{branchLabel(r.branch)}</td>
                  <td className="px-4 py-2.5">
                    {r.points > 0 &&
                      (r.pointsAreActual ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 whitespace-nowrap"
                          title="Read straight off the customer's GenBlu app screenshot"
                        >
                          <Award size={11} /> {r.points.toLocaleString()}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 bg-neutral-100 border border-neutral-200 rounded-full px-2 py-0.5 whitespace-nowrap"
                          title="No screenshot balance on file yet — estimated from job spending"
                        >
                          <Award size={11} /> ~{r.points.toLocaleString()} ({formatCurrency(r.points)})
                        </span>
                      ))}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditing(r)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-1"
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
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                    {registrations.length === 0 ? "No GenBlu registrations yet." : "No registrations match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <RegisterModal branch={branch} locked={locked} mechanics={mechanics} onClose={() => setModalOpen(false)} />
      )}

      {editing && (
        <EditModal registration={editing} mechanics={mechanics} onClose={() => setEditing(null)} />
      )}

      {deleting && (
        <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
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
        </div></ModalPortal>
      )}

      {lightboxUrl && (
        <ModalPortal><div
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
        </div></ModalPortal>
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
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">New GenBlu Registration</h2>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
            <div className="relative">
              <select
                name="branch"
                value={regBranch}
                onChange={(e) => handleBranchChange(e.target.value as Branch)}
                disabled={locked}
                className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer disabled:opacity-60"
              >
                {BRANCHES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
            <p className="text-xs text-neutral-500 mt-1.5">Pick the branch first — it decides which salespeople show up below.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Salesperson Name *</label>
            {branchMechanics.length > 0 ? (
              <div className="relative">
                <select
                  value={salespersonId}
                  onChange={(e) => setSalespersonId(e.target.value)}
                  className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
                >
                  {branchMechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.shortName} ({m.shortCode})
                    </option>
                  ))}
                  <option value="custom">Other (type manually)</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            ) : (
              <input
                type="text"
                name="salesperson_name"
                required
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
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
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Code</label>
                <input
                  type="text"
                  name="salesperson_code"
                  placeholder="e.g. NJ"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name</label>
            <input
              type="text"
              name="customer_name"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
            <p className="text-xs text-neutral-500 mt-1.5">Used to match this customer's spending to GenBlu points.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Plate No. *</label>
            <input
              type="text"
              name="customer_plate_no"
              required
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
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
              className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {isPending ? "Saving…" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div></ModalPortal>
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
  const [customerName, setCustomerName] = useState(registration.customerName);
  const [plateNo, setPlateNo] = useState(registration.customerPlateNo);
  const [screenshot, setScreenshot] = useState<File | null>(null);
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
        customerName,
        customerPlateNo: plateNo,
        screenshot,
      });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Edit GenBlu Registration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Salesperson Name *</label>
            {branchMechanics.length > 0 ? (
              <div className="relative">
                <select
                  value={salespersonId}
                  onChange={(e) => handleMechanicChange(e.target.value)}
                  className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
                >
                  {branchMechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.shortName} ({m.shortCode})
                    </option>
                  ))}
                  <option value="custom">Other (type manually)</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
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
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Code</label>
                <input
                  type="text"
                  value={salespersonCode}
                  onChange={(e) => setSalespersonCode(e.target.value)}
                  placeholder="e.g. NJ"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Plate No. *</label>
            <input
              type="text"
              value={plateNo}
              onChange={(e) => setPlateNo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Screenshot</label>
            {registration.screenshotUrl && !screenshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={registration.screenshotUrl}
                alt="Current GenBlu screenshot"
                className="w-full h-28 object-cover rounded-lg border border-neutral-200 mb-2"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
            />
            <p className="text-xs text-neutral-500 mt-1.5">
              {registration.screenshotUrl ? "Pick a new photo to replace the one above." : "No screenshot on file yet."}
            </p>
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
            className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}
