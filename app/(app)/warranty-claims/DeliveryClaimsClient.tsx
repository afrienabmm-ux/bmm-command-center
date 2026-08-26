"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Download, Trash2, Pencil, Check, X, ArrowUpDown, ChevronDown } from "lucide-react";
import {
  addDeliveryClaimAction,
  updateDeliveryClaimStatusAction,
  updateDeliveryClaimStockStatusAction,
  updateDeliveryClaimNotesAction,
  deleteDeliveryClaimAction,
} from "@/lib/delivery-claims-actions";
import { CLAIM_STATUSES, STOCK_STATUSES, type ClaimStatus, type StockStatus, type DeliveryClaim } from "@/lib/types";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate, toCsv } from "@/lib/format";
import { useToast } from "@/lib/useToast";

// Native <datalist> renders as a disconnected floating box on iOS Safari
// instead of anchoring under the input, so PIC suggestions use a plain
// controlled dropdown instead.
function PicAutocompleteField({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const matches = suggestions.filter((p) => p.toLowerCase().includes(value.trim().toLowerCase()));

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Person in Charge</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {matches.map((p) => (
            <button
              key={p}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 text-sm text-neutral-800 hover:bg-neutral-50 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<ClaimStatus, string> = {
  "In Process": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Proceed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  Rejected: "bg-red-500/10 text-red-700 border-red-500/20",
  "Close Ticket": "bg-neutral-200 text-neutral-600 border-neutral-300",
};

const STOCK_STYLES: Record<StockStatus, string> = {
  "In Stock": "bg-sky-500/10 text-sky-700 border-sky-500/20",
  Sold: "bg-red-500/10 text-red-700 border-red-500/20",
};

export default function DeliveryClaimsClient({
  claims,
  branchSelection,
  locked,
}: {
  claims: DeliveryClaim[];
  branchSelection: BranchSelection;
  locked: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "All">("All");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [exporting, setExporting] = useState(false);
  const showBranchColumn = branchSelection === "all";
  const { toastNode } = useToast();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = claims.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.plateNo, c.ticketId, c.status, c.pic, c.model, c.chassisNo].some((f) => (f ?? "").toLowerCase().includes(q));
    });
    return [...filtered].sort((a, b) =>
      sortDir === "desc" ? b.submittedDate.localeCompare(a.submittedDate) : a.submittedDate.localeCompare(b.submittedDate)
    );
  }, [claims, query, statusFilter, sortDir]);

  const knownPics = useMemo(() => Array.from(new Set(claims.map((c) => c.pic).filter(Boolean))).sort(), [claims]);

  function handleExport() {
    setExporting(true);
    try {
      const list = statusFilter === "All" ? claims : claims.filter((c) => c.status === statusFilter);
      const headers = ["Tarikh", "Ticket ID", "PIC", "Model", "Chassis No.", "No Engine", "Problem", "Status", "Jual/Belum", "No Plate", "Date Parts", "Delivery", "Reason"];
      const rows = list.map((c) => [
        formatDate(c.submittedDate),
        c.ticketId,
        c.pic,
        c.model,
        c.chassisNo,
        c.engineNo,
        c.problem,
        c.status,
        c.stockStatus,
        c.plateNo,
        c.dateParts,
        c.delivery,
        c.reason,
      ]);
      const finalHeaders = showBranchColumn ? [headers[0], "Branch", ...headers.slice(1)] : headers;
      const finalRows = showBranchColumn ? rows.map((r, i) => [r[0], branchLabel(list[i].branch), ...r.slice(1)]) : rows;
      const suffix = statusFilter === "All" ? "" : `-${statusFilter.toLowerCase().replace(/\s+/g, "-")}`;
      const csv = toCsv(finalHeaders, finalRows);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bmm-delivery-claims-${branchSelection}${suffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {toastNode}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plate, ticket ID, PIC, model…"
            className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-72"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            title="Sort by submitted date"
          >
            <ArrowUpDown size={14} /> {sortDir === "desc" ? "Newest" : "Oldest"}
          </button>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | "All")}
              className="appearance-none bg-white border border-neutral-200 hover:border-red-300 rounded-xl pl-3 pr-8 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
            >
              <option value="All">All Statuses</option>
              {CLAIM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
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
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
                <th className="font-medium px-5 py-3 whitespace-nowrap">Tarikh</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Ticket ID</th>
                {showBranchColumn && <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>}
                <th className="font-medium px-5 py-3 whitespace-nowrap">PIC</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Model</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Chassis No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">No Engine</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Problem</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Status</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Jual/Belum</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">No Plate</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Date Parts</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Delivery</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Reason</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <ClaimRow key={c.id} claim={c} showBranch={showBranchColumn} knownPics={knownPics} />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={showBranchColumn ? 15 : 14} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    {claims.length === 0 ? "No delivery claims yet." : "No claims match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <AddClaimModal branchSelection={branchSelection} locked={locked} knownPics={knownPics} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function ClaimRow({ claim, showBranch, knownPics }: { claim: DeliveryClaim; showBranch: boolean; knownPics: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  function handleDelete() {
    setDeleting(true);
    startTransition(async () => {
      await deleteDeliveryClaimAction(claim.id, claim.branch);
      setDeleting(false);
      setConfirmOpen(false);
    });
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{formatDate(claim.submittedDate)}</td>
      <td className="px-5 py-3.5 text-neutral-900 font-semibold whitespace-nowrap">{claim.ticketId}</td>
      {showBranch && <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{branchLabel(claim.branch)}</td>}
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{claim.pic || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.model || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.chassisNo || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.engineNo || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 max-w-xs truncate">{claim.problem}</td>
      <td className="px-5 py-3.5 text-center">
        <StatusCell claim={claim} />
      </td>
      <td className="px-5 py-3.5 text-center">
        <StockCell claim={claim} />
      </td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.plateNo || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 max-w-[140px] truncate" title={claim.dateParts || undefined}>
        {claim.dateParts || "—"}
      </td>
      <td className="px-5 py-3.5 text-neutral-600 max-w-[140px] truncate" title={claim.delivery || undefined}>
        {claim.delivery || "—"}
      </td>
      <td className="px-5 py-3.5">
        <ReasonCell claim={claim} />
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <button
          onClick={() => setNotesOpen(true)}
          className="text-neutral-400 hover:text-red-600 transition-colors p-1"
          title="Edit PIC"
          aria-label="Edit PIC"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          className="text-neutral-400 hover:text-red-600 transition-colors p-1"
          title="Delete claim"
          aria-label="Delete claim"
        >
          <Trash2 size={15} />
        </button>

        {notesOpen && <PicModal claim={claim} knownPics={knownPics} onClose={() => setNotesOpen(false)} />}

        {confirmOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 text-left">
              <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete this claim?</h2>
              <p className="text-sm text-neutral-600 mb-6">
                Ticket <span className="text-neutral-800 font-medium">{claim.ticketId}</span> for plate{" "}
                <span className="text-neutral-800 font-medium">{claim.plateNo}</span> will be permanently removed.
                This can&apos;t be undone.
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

function StatusCell({ claim }: { claim: DeliveryClaim }) {
  const [isPending, startTransition] = useTransition();
  const { showError, toastNode } = useToast();
  function handleChange(next: ClaimStatus) {
    startTransition(async () => {
      const result = await updateDeliveryClaimStatusAction(claim.id, claim.branch, next);
      if (result && "error" in result) showError(result.error);
    });
  }
  return (
    <>
      {toastNode}
      <select
        value={claim.status}
        onChange={(e) => handleChange(e.target.value as ClaimStatus)}
        disabled={isPending}
        className={`text-xs font-medium pl-2.5 pr-6 py-1.5 rounded-full border transition-colors disabled:opacity-50 cursor-pointer ${STATUS_STYLES[claim.status]}`}
      >
        {CLAIM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </>
  );
}

function StockCell({ claim }: { claim: DeliveryClaim }) {
  const [isPending, startTransition] = useTransition();
  const { showError, toastNode } = useToast();
  function handleClick() {
    const next = STOCK_STATUSES[(STOCK_STATUSES.indexOf(claim.stockStatus) + 1) % STOCK_STATUSES.length];
    startTransition(async () => {
      const result = await updateDeliveryClaimStockStatusAction(claim.id, claim.branch, next);
      if (result && "error" in result) showError(result.error);
    });
  }
  return (
    <>
      {toastNode}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={`Click to cycle: ${STOCK_STATUSES.join(" -> ")}`}
        className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${STOCK_STYLES[claim.stockStatus]}`}
      >
        {claim.stockStatus}
      </button>
    </>
  );
}

// Quick inline edit for the Reason note — same pencil-in-place pattern as
// Warranty Claim's Latest Status, so a PIC doesn't need the full modal
// just to jot "1/2 item arrived".
function ReasonCell({ claim }: { claim: DeliveryClaim }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(claim.reason);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateDeliveryClaimNotesAction(claim.id, claim.branch, { dateParts: claim.dateParts, delivery: claim.delivery, reason: value });
      setEditing(false);
    });
  }

  function handleCancel() {
    setValue(claim.reason);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[160px]">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          placeholder="e.g. 1/2 item arrived"
          className="flex-1 bg-neutral-50 border border-red-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none"
        />
        <button onClick={handleSave} disabled={isPending} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50 p-1" title="Save" aria-label="Save">
          <Check size={14} />
        </button>
        <button onClick={handleCancel} className="text-neutral-400 hover:text-red-600 p-1" title="Cancel" aria-label="Cancel">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 max-w-xs">
      <span className="text-neutral-600 truncate" title={claim.reason || undefined}>
        {claim.reason || "—"}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="text-neutral-400 hover:text-red-600 transition-colors p-1 shrink-0"
        title="Update reason"
        aria-label="Update reason"
      >
        <Pencil size={13} />
      </button>
    </div>
  );
}

function PicModal({ claim, knownPics, onClose }: { claim: DeliveryClaim; knownPics: string[]; onClose: () => void }) {
  const [pic, setPic] = useState(claim.pic);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateDeliveryClaimNotesAction(claim.id, claim.branch, {
        pic,
        dateParts: claim.dateParts,
        delivery: claim.delivery,
        reason: claim.reason,
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 text-left">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Edit PIC</h2>
        <p className="text-xs text-neutral-500 mb-5">
          Ticket {claim.ticketId} · {claim.plateNo}
        </p>
        <PicAutocompleteField value={pic} onChange={setPic} suggestions={knownPics} placeholder="e.g. VINCENT" />
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddClaimModal({
  branchSelection,
  locked,
  knownPics,
  onClose,
}: {
  branchSelection: BranchSelection;
  locked: boolean;
  knownPics: string[];
  onClose: () => void;
}) {
  const [ticketId, setTicketId] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<Branch>(branchSelection === "all" ? BRANCHES[0].value : branchSelection);
  const [pic, setPic] = useState("");
  const [model, setModel] = useState("");
  const [chassisNo, setChassisNo] = useState("");
  const [engineNo, setEngineNo] = useState("");
  const [problem, setProblem] = useState("");
  const [stockStatus, setStockStatus] = useState<StockStatus>("In Stock");
  const [plateNo, setPlateNo] = useState("");
  const [dateParts, setDateParts] = useState("");
  const [reason, setReason] = useState("");
  const [submittedDate, setSubmittedDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSave = ticketId.trim() !== "" && plateNo.trim() !== "" && problem.trim() !== "";

  function handleSave() {
    if (!canSave) {
      setError("Ticket ID, plate number, and the problem description are all required.");
      return;
    }
    startTransition(async () => {
      const result = await addDeliveryClaimAction({
        branch: selectedBranch,
        ticketId: ticketId.trim(),
        pic: pic.trim(),
        model: model.trim(),
        chassisNo: chassisNo.trim(),
        engineNo: engineNo.trim(),
        problem: problem.trim(),
        stockStatus,
        plateNo: plateNo.trim(),
        dateParts: dateParts.trim(),
        reason: reason.trim(),
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
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Add Delivery Claim</h2>
        <div className="space-y-4">
          {!locked && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch *</label>
              <div className="relative">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value as Branch)}
                  className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
                >
                  {BRANCHES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Ticket ID *</label>
            <input
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. 001-00-047097"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <PicAutocompleteField value={pic} onChange={setPic} suggestions={knownPics} placeholder="e.g. VINCENT" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Plate No. *</label>
              <input
                type="text"
                value={plateNo}
                onChange={(e) => setPlateNo(e.target.value)}
                placeholder="e.g. WXX 5231"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Y15ZR SE"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Chassis No.</label>
              <input
                type="text"
                value={chassisNo}
                onChange={(e) => setChassisNo(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">No Engine</label>
              <input
                type="text"
                value={engineNo}
                onChange={(e) => setEngineNo(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Problem *</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={3}
              placeholder="e.g. Left cover set dented"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Jual/Belum</label>
              <div className="relative">
                <select
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value as StockStatus)}
                  className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
                >
                  {STOCK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Tarikh</label>
              <input
                type="date"
                value={submittedDate}
                onChange={(e) => setSubmittedDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Date Parts</label>
            <input
              type="text"
              value={dateParts}
              onChange={(e) => setDateParts(e.target.value)}
              placeholder="e.g. 29/7 EMBLEM"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. 2/3 item has arrived"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-700 mt-4">{error}</p>}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add Claim
          </button>
        </div>
      </div>
    </div>
  );
}
