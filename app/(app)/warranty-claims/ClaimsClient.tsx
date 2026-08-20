"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Download, Trash2, Pencil, Printer, Check, X } from "lucide-react";
import {
  addWarrantyClaimAction,
  updateClaimStatusAction,
  updateClaimStockStatusAction,
  updateClaimNotesAction,
  deleteClaimAction,
} from "@/lib/claims-actions";
import {
  CLAIM_STATUSES,
  STOCK_STATUSES,
  BIKE_MAKES,
  type ClaimStatus,
  type StockStatus,
  type BikeMake,
  type WarrantyClaim,
} from "@/lib/types";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate, toCsv } from "@/lib/format";

const STATUS_STYLES: Record<ClaimStatus, string> = {
  "In Process": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  Rejected: "bg-red-500/10 text-red-700 border-red-500/20",
  "Close Ticket": "bg-neutral-200 text-neutral-600 border-neutral-300",
};

const STOCK_STYLES: Record<StockStatus, string> = {
  "In Stock": "bg-sky-500/10 text-sky-700 border-sky-500/20",
  Sold: "bg-purple-500/10 text-purple-700 border-purple-500/20",
};

export default function ClaimsClient({
  claims,
  branchSelection,
  locked,
}: {
  claims: WarrantyClaim[];
  branchSelection: BranchSelection;
  locked: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "All">("All");
  const [bikeMakeFilter, setBikeMakeFilter] = useState<BikeMake | "All">("All");
  const [exporting, setExporting] = useState(false);
  const showBranchColumn = branchSelection === "all";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return claims.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (bikeMakeFilter !== "All" && c.bikeMake !== bikeMakeFilter) return false;
      if (!q) return true;
      return [c.customerName, c.plateNo, c.ticketId, c.status, c.pic, c.model, c.latestStatus].some((f) =>
        (f ?? "").toLowerCase().includes(q)
      );
    });
  }, [claims, query, statusFilter, bikeMakeFilter]);

  // Every PIC name already used, so the add form can offer them instead of
  // relying on everyone spelling it the same way.
  const knownPics = useMemo(
    () => Array.from(new Set(claims.map((c) => c.pic).filter(Boolean))).sort(),
    [claims]
  );

  const EXPORT_HEADERS = ["Ticket ID", "Submitted Date", "PIC", "Customer", "Plate No", "Model", "Phone", "Issue", "Stock Status", "Status", "Latest Status"];

  function exportRows(list: WarrantyClaim[]): (string | number)[][] {
    return list.map((c) => {
      const row: (string | number)[] = [
        c.ticketId,
        formatDate(c.submittedDate),
        c.pic,
        c.customerName,
        c.plateNo,
        c.model,
        c.phone,
        c.description,
        c.stockStatus,
        c.status,
        c.latestStatus,
      ];
      if (showBranchColumn) row.splice(1, 0, branchLabel(c.branch));
      return row;
    });
  }

  function downloadCsv(rows: (string | number)[][], filename: string) {
    const headers = showBranchColumn ? [EXPORT_HEADERS[0], "Branch", ...EXPORT_HEADERS.slice(1)] : EXPORT_HEADERS;
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Yamaha and non-Yamaha claims always go in separate files — mixing the
  // two brands in one export defeats the point of tracking them apart.
  function handleExport() {
    setExporting(true);
    try {
      const statusFiltered = statusFilter === "All" ? claims : claims.filter((c) => c.status === statusFilter);
      const suffix = statusFilter === "All" ? "" : `-${statusFilter.toLowerCase().replace(/\s+/g, "-")}`;

      if (bikeMakeFilter === "All") {
        for (const make of BIKE_MAKES) {
          const list = statusFiltered.filter((c) => c.bikeMake === make);
          if (list.length === 0) continue;
          downloadCsv(exportRows(list), `bmm-warranty-claims-${branchSelection}${suffix}-${make.toLowerCase()}.csv`);
        }
      } else {
        const list = statusFiltered.filter((c) => c.bikeMake === bikeMakeFilter);
        downloadCsv(exportRows(list), `bmm-warranty-claims-${branchSelection}${suffix}-${bikeMakeFilter.toLowerCase()}.csv`);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PicScoreboard claims={claims} />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, plate, ticket ID, PIC, status…"
            className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 w-72"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={bikeMakeFilter}
            onChange={(e) => setBikeMakeFilter(e.target.value as BikeMake | "All")}
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="All">View All</option>
            {BIKE_MAKES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
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
                {showBranchColumn && <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>}
                <th className="font-medium px-5 py-3 whitespace-nowrap">Submitted</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">PIC</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Customer</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Plate No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Model</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Make</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Phone</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Issue</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Stock</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Latest Status</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <ClaimRow key={c.id} claim={c} showBranch={showBranchColumn} knownPics={knownPics} />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={showBranchColumn ? 14 : 13} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    {claims.length === 0 ? "No warranty claims yet." : "No claims match your search."}
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

function ClaimRow({ claim, showBranch, knownPics }: { claim: WarrantyClaim; showBranch: boolean; knownPics: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  function handleDelete() {
    setDeleting(true);
    startTransition(async () => {
      await deleteClaimAction(claim.id, claim.branch);
      setDeleting(false);
      setConfirmOpen(false);
    });
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-900 font-semibold whitespace-nowrap">{claim.ticketId}</td>
      {showBranch && <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{branchLabel(claim.branch)}</td>}
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{formatDate(claim.submittedDate)}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{claim.pic || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{claim.customerName}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.plateNo}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.model || "—"}</td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            claim.bikeMake === "Yamaha"
              ? "bg-red-500/10 text-red-700 border-red-500/20"
              : "bg-neutral-100 text-neutral-600 border-neutral-300"
          }`}
        >
          {claim.bikeMake}
        </span>
      </td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{claim.phone || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 max-w-xs truncate">{claim.description}</td>
      <td className="px-5 py-3.5">
        <StockCell claim={claim} />
      </td>
      <td className="px-5 py-3.5">
        <StatusCell claim={claim} />
      </td>
      <td className="px-5 py-3.5">
        <LatestStatusCell claim={claim} />
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <button
          onClick={() => setNotesOpen(true)}
          className="text-neutral-400 hover:text-indigo-600 transition-colors p-1"
          title="Edit PIC"
          aria-label="Edit PIC"
        >
          <Pencil size={15} />
        </button>
        <Link
          href={`/warranty-claims/${claim.id}/print`}
          target="_blank"
          className="text-neutral-400 hover:text-indigo-600 transition-colors p-1 inline-block"
          title="Print claim"
          aria-label="Print claim"
        >
          <Printer size={15} />
        </Link>
        <button
          onClick={() => setConfirmOpen(true)}
          className="text-neutral-400 hover:text-red-600 transition-colors p-1"
          title="Delete claim"
          aria-label="Delete claim"
        >
          <Trash2 size={15} />
        </button>

        {notesOpen && (
          <NotesModal claim={claim} knownPics={knownPics} onClose={() => setNotesOpen(false)} />
        )}

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

// Status dropdown — picks directly from the 4 statuses instead of
// clicking through them one at a time.
function StatusCell({ claim }: { claim: WarrantyClaim }) {
  const [isPending, startTransition] = useTransition();
  function handleChange(next: ClaimStatus) {
    startTransition(async () => {
      const result = await updateClaimStatusAction(claim.id, claim.branch, next);
      if (result && "error" in result) window.alert(result.error);
    });
  }
  return (
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
  );
}

// Click-to-cycle Stock button — same idea, just two states.
function StockCell({ claim }: { claim: WarrantyClaim }) {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    const next = STOCK_STATUSES[(STOCK_STATUSES.indexOf(claim.stockStatus) + 1) % STOCK_STATUSES.length];
    startTransition(async () => {
      const result = await updateClaimStockStatusAction(claim.id, claim.branch, next);
      if (result && "error" in result) window.alert(result.error);
    });
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={`Click to cycle: ${STOCK_STATUSES.join(" -> ")}`}
      className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${STOCK_STYLES[claim.stockStatus]}`}
    >
      {claim.stockStatus}
    </button>
  );
}

// Quick inline edit for just the Latest Status note — a pencil right next
// to the text, so a PIC doesn't have to open the full "edit everything"
// modal just to update this one field.
function LatestStatusCell({ claim }: { claim: WarrantyClaim }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(claim.latestStatus);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateClaimNotesAction(claim.id, claim.branch, { pic: claim.pic, latestStatus: value, reason: claim.reason });
      setEditing(false);
    });
  }

  function handleCancel() {
    setValue(claim.latestStatus);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[180px]">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          placeholder="e.g. ETA: waiting SCM reply"
          className="flex-1 bg-neutral-50 border border-indigo-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50 p-1"
          title="Save"
          aria-label="Save"
        >
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
      <span className="text-neutral-600 truncate" title={claim.latestStatus || undefined}>
        {claim.latestStatus || "—"}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="text-neutral-400 hover:text-indigo-600 transition-colors p-1 shrink-0"
        title="Update latest status"
        aria-label="Update latest status"
      >
        <Pencil size={13} />
      </button>
    </div>
  );
}

// Mirrors the summary table at the top of their spreadsheet: how many
// claims each person is carrying, and where those claims stand.
function PicScoreboard({ claims }: { claims: WarrantyClaim[] }) {
  const rows = useMemo(() => {
    const byPic = new Map<string, Record<ClaimStatus, number> & { total: number }>();
    for (const c of claims) {
      const key = c.pic.trim() || "Unassigned";
      let row = byPic.get(key);
      if (!row) {
        row = { Approved: 0, "In Process": 0, "Close Ticket": 0, Rejected: 0, total: 0 };
        byPic.set(key, row);
      }
      row[c.status] += 1;
      row.total += 1;
    }
    return Array.from(byPic.entries())
      .map(([pic, counts]) => ({ pic, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [claims]);

  if (rows.length === 0) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-neutral-200">
        <p className="text-sm font-semibold text-neutral-900">Claims by Person in Charge</p>
        <p className="text-xs text-neutral-500 mt-0.5">Where each person&apos;s claims currently stand</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="font-medium px-5 py-3 whitespace-nowrap">PIC</th>
              {CLAIM_STATUSES.map((s) => (
                <th key={s} className="font-medium px-5 py-3 whitespace-nowrap">
                  {s}
                </th>
              ))}
              <th className="font-medium px-5 py-3 whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pic} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-5 py-3 text-neutral-800 font-medium whitespace-nowrap">{r.pic}</td>
                {CLAIM_STATUSES.map((s) => (
                  <td key={s} className="px-5 py-3 whitespace-nowrap tabular-nums">
                    {r[s] > 0 ? (
                      <span className="text-neutral-800">{r[s]}</span>
                    ) : (
                      <span className="text-neutral-300">0</span>
                    )}
                  </td>
                ))}
                <td className="px-5 py-3 text-neutral-900 font-semibold whitespace-nowrap tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotesModal({
  claim,
  knownPics,
  onClose,
}: {
  claim: WarrantyClaim;
  knownPics: string[];
  onClose: () => void;
}) {
  const [pic, setPic] = useState(claim.pic);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateClaimNotesAction(claim.id, claim.branch, { pic, latestStatus: claim.latestStatus, reason: claim.reason });
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
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Person in Charge</label>
          <input
            type="text"
            list="known-pics"
            value={pic}
            onChange={(e) => setPic(e.target.value)}
            placeholder="e.g. SK"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
          />
          <datalist id="known-pics">
            {knownPics.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
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
            disabled={isPending}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
  const [selectedBranch, setSelectedBranch] = useState<Branch>(
    branchSelection === "all" ? BRANCHES[0].value : branchSelection
  );
  const [customerName, setCustomerName] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [model, setModel] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [stockStatus, setStockStatus] = useState<StockStatus>("In Stock");
  const [bikeMake, setBikeMake] = useState<BikeMake>("Yamaha");
  const [submittedDate, setSubmittedDate] = useState(new Date().toISOString().slice(0, 10));
  const [pic, setPic] = useState("");
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
        branch: selectedBranch,
        ticketId: ticketId.trim(),
        customerName: customerName.trim(),
        plateNo: plateNo.trim(),
        model: model.trim(),
        phone: phone.trim(),
        description: description.trim(),
        stockStatus,
        bikeMake,
        submittedDate,
        pic: pic.trim(),
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
          {!locked && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch *</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as Branch)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              >
                {BRANCHES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          )}
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Person in Charge</label>
            <input
              type="text"
              list="known-pics-add"
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              placeholder="e.g. SK"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            <datalist id="known-pics-add">
              {knownPics.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Bike Make</label>
            <select
              value={bikeMake}
              onChange={(e) => setBikeMake(e.target.value as BikeMake)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              {BIKE_MAKES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
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
