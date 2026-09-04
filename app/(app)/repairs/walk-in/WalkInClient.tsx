"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Download, Pencil, Search, Trash2, Check, Printer, ArrowUpDown, ChevronDown, ImageIcon, Link2 } from "lucide-react";
import {
  setWalkInEndDateAction,
  deleteRepairJobAction,
  getJobsheetPhotoUrlAction,
  resolveSignatureIssueAction,
} from "@/lib/repairs-actions";
import { isHeavyRepairJob, type RepairStatus, type RepairJob } from "@/lib/types";
import type { Mechanic } from "@/lib/types";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency, formatDate, daysBetween, toCsv } from "@/lib/format";
import { todayInMalaysia } from "@/lib/malaysia-time";
import { useToast } from "@/lib/useToast";
import ModalPortal from "@/components/ModalPortal";

// Walk-in jobs never enter QC (that's Restore Bike only), but the shared
// RepairStatus type still includes it, so this map needs an entry too.
const STATUS_STYLES: Record<RepairStatus, string> = {
  Pending: "bg-neutral-100 text-neutral-700 border-neutral-300",
  "In Progress": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  QC: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

export default function WalkInClient({
  active,
  completed,
  errors,
  mechanics,
  branchSelection,
  highlightId,
  canEdit,
  canResolveErrors,
}: {
  active: RepairJob[];
  completed: RepairJob[];
  errors: RepairJob[];
  mechanics: Mechanic[];
  branchSelection: BranchSelection;
  highlightId?: string;
  canEdit: boolean;
  canResolveErrors: boolean;
}) {
  // The Active tab hides itself entirely when there's nothing in it (same
  // as Errors) — defaulting straight to Completed in that case avoids
  // landing on a tab bar with no button highlighted at all.
  const [tab, setTab] = useState<"active" | "completed" | "errors">(active.length > 0 ? "active" : "completed");
  const [exporting, setExporting] = useState(false);
  const [exportJobModalOpen, setExportJobModalOpen] = useState(false);
  const [exportFilteredModalOpen, setExportFilteredModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  // Filters by Job Date (the same field the "Job Date" column shows) —
  // a plain flat list with no way to narrow down to a specific day or
  // range made it easy to lose track of which rows were even from.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Completed defaults to today only — years of history dumped into one
  // flat list was the whole complaint. Active/Errors still show
  // everything regardless of date, since a job started days ago still
  // needs to stay visible until it's actually done. "See All" (below)
  // clears this back to the full list.
  useEffect(() => {
    if (tab === "completed") {
      const today = todayInMalaysia();
      setDateFrom(today);
      setDateTo(today);
    } else {
      setDateFrom("");
      setDateTo("");
    }
  }, [tab]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // A slim second scrollbar mirrored above the table — this table is wide
  // enough that its own horizontal scrollbar sits below a long list of
  // rows, out of sight until scrolled all the way down. Dragging either
  // one moves the same content; a ref guards against the two onScroll
  // handlers feeding back into each other in an infinite loop.
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const syncingFrom = useRef<"top" | "table" | null>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportMenuOpen]);

  // Copies the standalone phone scanner's own URL (not this dashboard
  // page) so a PIC can hand it to their admin — that link needs no login
  // and only ever does jobsheet scanning, see middleware.ts.
  async function handleCopyPhoneLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/scan`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // Clipboard access can fail (permissions, non-HTTPS) — nothing
      // meaningful to recover, just leave the button as-is.
    }
  }

  // Deep-linked from a dashboard alert (e.g. "due for their next
  // service") — jump to whichever tab the job is actually in and clear
  // any search so it's guaranteed to be visible.
  useEffect(() => {
    if (!highlightId) return;
    if (active.some((j) => j.id === highlightId)) setTab("active");
    else if (completed.some((j) => j.id === highlightId)) setTab("completed");
    else if (errors.some((j) => j.id === highlightId)) setTab("errors");
    setQuery("");
  }, [highlightId, active, completed, errors]);

  const jobs = tab === "active" ? active : tab === "completed" ? completed : errors;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = jobs.filter((j) => {
      if (q && !((j.customerName ?? "").toLowerCase().includes(q) || j.plateNo.toLowerCase().includes(q))) return false;
      const jobDate = j.startedDate ?? "";
      if (dateFrom && jobDate < dateFrom) return false;
      if (dateTo && jobDate > dateTo) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const dateOf = (j: RepairJob) => j.completedDate || j.startedDate || j.createdAt || "";
      return sortDir === "desc" ? dateOf(b).localeCompare(dateOf(a)) : dateOf(a).localeCompare(dateOf(b));
    });
  }, [jobs, query, sortDir, dateFrom, dateTo]);
  const allJobs = useMemo(() => [...active, ...completed], [active, completed]);
  const showBranchColumn = branchSelection === "all";

  // Selection is scoped to whatever's currently visible — switching tabs
  // or typing a new search clears it rather than silently carrying over
  // picks the PIC can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, query]);

  // Re-measures whenever the row count or column set changes (branch
  // column toggling, tab switch) — those are the things that actually
  // change how wide the table is — plus on window resize for a narrower
  // viewport.
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const update = () => setTableScrollWidth(el.scrollWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [visible, showBranchColumn]);

  function handleTopScroll() {
    if (syncingFrom.current === "table") return;
    syncingFrom.current = "top";
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    syncingFrom.current = null;
  }

  function handleTableScroll() {
    if (syncingFrom.current === "top") return;
    syncingFrom.current = "table";
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
    syncingFrom.current = null;
  }

  const allVisibleSelected = visible.length > 0 && visible.every((j) => selectedIds.has(j.id));

  function toggleSelectAll() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visible.map((j) => j.id)));
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    setBulkDeleting(true);
    const targets = allJobs.filter((j) => selectedIds.has(j.id));
    Promise.all(targets.map((j) => deleteRepairJobAction(j.id, j.branch))).then(() => {
      setBulkDeleting(false);
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
    });
  }

  function mechanicLabel(id: string | null) {
    if (!id) return "—";
    const m = mechanics.find((m) => m.id === id);
    return m ? `${m.shortName} (${m.shortCode})` : "—";
  }

  function buildRows(list: RepairJob[]) {
    const today = new Date().toISOString().slice(0, 10);
    return list.map((j) => [
      j.jobNo,
      j.customerName,
      j.plateNo,
      j.model,
      mechanicLabel(j.mechanicId),
      j.revenueAmount.toFixed(2),
      j.startedDate ? formatDate(j.startedDate) : "",
      j.completedDate ? formatDate(j.completedDate) : "",
      daysBetween(j.startedDate, j.completedDate ?? today) ?? 0,
      j.status,
    ]);
  }

  const HEADERS = ["Job No", "Customer", "Plate No", "Model", "Mechanic", "Cost Total (RM)", "Job Date", "Completed Date", "Days Taken", "Status"];

  function handleExport() {
    setExporting(true);
    try {
      const csv = toCsv(HEADERS, buildRows(allJobs));
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bmm-walk-in-${branchSelection}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleExportFiltered(matches: RepairJob[]) {
    const csv = toCsv(HEADERS, buildRows(matches));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bmm-walk-in-${branchSelection}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportFilteredModalOpen(false);
  }

  function handleExportSingleJob(job: RepairJob) {
    const rows: (string | number)[][] =
      job.items.length > 0
        ? job.items.map((item) => [
            job.jobNo,
            job.customerName,
            job.plateNo,
            job.status,
            item.description,
            item.quantity,
            item.price.toFixed(2),
            (item.quantity * item.price).toFixed(2),
          ])
        : [[job.jobNo, job.customerName, job.plateNo, job.status, "—", "", "", ""]];
    rows.push(["", "", "", "", "", "", "Total", job.revenueAmount.toFixed(2)]);
    const csv = toCsv(
      ["Job No", "Customer", "Plate No", "Status", "Item Description", "Qty", "Price (RM)", "Line Total (RM)"],
      rows
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bmm-walk-in-job-${job.jobNo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportJobModalOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-white border border-neutral-200 rounded-lg p-1">
          {active.length > 0 && (
            <button
              onClick={() => setTab("active")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === "active" ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              Active ({active.length})
            </button>
          )}
          <button
            onClick={() => setTab("completed")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "completed" ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Completed ({completed.length})
          </button>
          {errors.length > 0 && (
            <button
              onClick={() => setTab("errors")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === "errors" ? "bg-red-500 text-white" : "text-red-600 hover:text-red-700"
              }`}
            >
              Errors ({errors.length})
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer or plate no…"
              className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-64"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Job Date from"
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
          />
          <span className="text-sm text-neutral-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Job Date to"
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
          />
          {tab === "completed" ? (
            <button
              onClick={() => {
                if (dateFrom || dateTo) {
                  setDateFrom("");
                  setDateTo("");
                } else {
                  const today = todayInMalaysia();
                  setDateFrom(today);
                  setDateTo(today);
                }
              }}
              title={dateFrom || dateTo ? "Show every completed job" : "Back to today's jobs only"}
              className="bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {dateFrom || dateTo ? "See All" : "Today Only"}
            </button>
          ) : (
            (dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                title="Show every job regardless of date"
                className="bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                See All
              </button>
            )
          )}
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            title="Sort by date"
          >
            <ArrowUpDown size={14} /> {sortDir === "desc" ? "Newest" : "Oldest"}
          </button>
          <button
            onClick={handleCopyPhoneLink}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            title="Copy the phone jobsheet scanner link to send to an admin"
          >
            <Link2 size={14} /> {linkCopied ? "Copied!" : "Copy Phone Link"}
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download size={15} />
              {exporting ? "Exporting…" : "Export"}
              <ChevronDown size={14} className={`transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {exportMenuOpen && (
              <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-neutral-200 rounded-xl shadow-lg py-1.5 w-56">
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExport();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                >
                  <Download size={14} /> Export All (CSV)
                </button>
                {allJobs.length > 0 && (
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      setExportFilteredModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                  >
                    <Download size={14} /> Export Filtered…
                  </button>
                )}
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    setExportJobModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                >
                  <Search size={14} /> Export One Job (with items)
                </button>
              </div>
            )}
          </div>
          {canEdit && selectedIds.size > 0 && (
            <button
              onClick={() => setBulkDeleteOpen(true)}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <Trash2 size={15} /> Delete Selected ({selectedIds.size})
            </button>
          )}
          {canEdit && (
            <Link
              href="/repairs/walk-in/new"
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} /> Add Job
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {tableScrollWidth > 0 && (
          <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden border-b border-neutral-200" style={{ height: 14 }}>
            <div style={{ width: tableScrollWidth, height: 1 }} />
          </div>
        )}
        <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                {canEdit && (
                  <th className="px-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      disabled={visible.length === 0}
                      aria-label="Select all"
                      className="accent-red-500"
                    />
                  </th>
                )}
                <th className="font-medium px-5 py-3 whitespace-nowrap">Job No.</th>
                {showBranchColumn && <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>}
                <th className="font-medium px-5 py-3 whitespace-nowrap">Customer</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Plate No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Model</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Cost Total</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Job Date</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">End Date</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Days</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Next Service</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.length > 0 && (
                <tr className="bg-emerald-50">
                  <td
                    colSpan={(canEdit ? 1 : 0) + (showBranchColumn ? 1 : 0) + 12}
                    className="px-5 py-2.5 whitespace-nowrap text-sm font-semibold text-emerald-900"
                  >
                    Total: {visible.length} job{visible.length === 1 ? "" : "s"}
                  </td>
                </tr>
              )}
              {visible.map((job) => (
                <WalkInRow
                  key={job.id}
                  job={job}
                  showBranch={showBranchColumn}
                  mechanicLabel={mechanicLabel(job.mechanicId)}
                  editable={canEdit && tab === "active"}
                  canEdit={canEdit}
                  canResolveErrors={canResolveErrors}
                  highlight={job.id === highlightId}
                  selected={selectedIds.has(job.id)}
                  onToggleSelect={() => toggleSelectOne(job.id)}
                />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={(showBranchColumn ? 13 : 12) + (canEdit ? 1 : 0)}
                    className="px-5 py-10 text-center text-neutral-500 text-sm"
                  >
                    {jobs.length === 0
                      ? `${tab === "active" ? "No active" : tab === "completed" ? "No completed" : "No"} Jobsheet jobs${tab === "errors" ? " need checking" : ""}.`
                      : "No jobs match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {exportJobModalOpen && (
        <ExportJobModal jobs={allJobs} onExport={handleExportSingleJob} onClose={() => setExportJobModalOpen(false)} />
      )}

      {exportFilteredModalOpen && (
        <ExportFilteredModal
          jobs={allJobs}
          mechanics={mechanics}
          onExport={handleExportFiltered}
          onClose={() => setExportFilteredModalOpen(false)}
        />
      )}

      {bulkDeleteOpen && (
        <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 text-left">
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete {selectedIds.size} job{selectedIds.size === 1 ? "" : "s"}?</h2>
            <p className="text-sm text-neutral-600 mb-6">These jobs will be permanently removed. This can&apos;t be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div></ModalPortal>
      )}
    </div>
  );
}

function ExportFilteredModal({
  jobs,
  mechanics,
  onExport,
  onClose,
}: {
  jobs: RepairJob[];
  mechanics: Mechanic[];
  onExport: (matches: RepairJob[]) => void;
  onClose: () => void;
}) {
  const [mechanicId, setMechanicId] = useState<string>("all");
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (mechanicId !== "all" && j.mechanicId !== mechanicId) return false;
      if (q && !(j.plateNo.toLowerCase().includes(q) || j.jobNo.toLowerCase().includes(q) || j.customerName.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [jobs, mechanicId, query]);

  const hasFilters = mechanicId !== "all" || query.trim() !== "";

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Export Jobsheet Jobs</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Export every Jobsheet job, or narrow it down by mechanic, job no., plate no. or customer name first.
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mechanic</label>
            <div className="relative">
              <select
                value={mechanicId}
                onChange={(e) => setMechanicId(e.target.value)}
                className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
              >
                <option value="all">All Mechanics</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.shortName} ({m.shortCode})
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Job No. / Plate No. / Customer</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mb-2">
          {matches.length} of {jobs.length} Jobsheet job{jobs.length === 1 ? "" : "s"} match
          {hasFilters ? " your filters" : ""}.
        </p>
        <div className="max-h-56 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100 mb-4">
          {matches.length === 0 && <p className="text-sm text-neutral-500 text-center py-6">No matching jobs.</p>}
          {matches.map((job) => (
            <div key={job.id} className="px-4 py-2.5">
              <p className="text-sm font-medium text-neutral-800">{job.jobNo} — {job.plateNo}</p>
              <p className="text-xs text-neutral-500">{job.customerName || "—"}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onExport(matches)}
            disabled={matches.length === 0}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={15} /> {hasFilters ? `Export ${matches.length} Filtered` : "Export All"}
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}

function ExportJobModal({
  jobs,
  onExport,
  onClose,
}: {
  jobs: RepairJob[];
  onExport: (job: RepairJob) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? jobs.filter((j) => j.jobNo.toLowerCase().includes(q) || j.plateNo.toLowerCase().includes(q))
      : jobs;
    return list.slice(0, 20);
  }, [jobs, query]);

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Export One Job</h2>
        <p className="text-xs text-neutral-500 mb-4">Search by Job No. or Plate No. — the export will include every item and price for that job.</p>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job no. or plate no."
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
          />
        </div>
        <div className="max-h-72 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
          {matches.length === 0 && <p className="text-sm text-neutral-500 text-center py-8">No matching jobs.</p>}
          {matches.map((job) => (
            <button
              key={job.id}
              onClick={() => onExport(job)}
              className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 transition-colors flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-800">{job.jobNo} — {job.plateNo}</p>
                <p className="text-xs text-neutral-500">{job.customerName || "—"} · {job.items.length} item{job.items.length === 1 ? "" : "s"} · {formatCurrency(job.revenueAmount)}</p>
              </div>
              <Download size={14} className="text-neutral-400 shrink-0" />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end mt-5">
          <button onClick={onClose} className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}

// Status is no longer a manual choice here — it just follows the End Date
// stamp (see EndDateCell), so this is read-only.
// Flags when a job was saved despite the scan not finding a signature —
// staff can still tick "Customer has signed" by hand, but this makes that
// override visible on the job afterward instead of forgotten once the
// form closes.
function StatusCell({
  status,
  signatureStatus,
  signatureIssueResolved,
}: {
  status: RepairStatus;
  signatureStatus: string;
  signatureIssueResolved: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[status]}`}>{status}</span>
      {signatureStatus === "not_detected" && !signatureIssueResolved && (
        <span
          title="Scan found no signature, but staff confirmed it was signed anyway"
          className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-red-500/10 text-red-700 border-red-500/20"
        >
          No sign detected
        </span>
      )}
      {signatureStatus === "unchecked" && (
        <span
          title="Scan couldn't check for a signature — staff confirmed by hand"
          className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-neutral-100 text-neutral-500 border-neutral-200"
        >
          Sign unchecked
        </span>
      )}
    </div>
  );
}

// Same shape as Restore Bike's date-format helper — "17/8" is compact
// enough to sit inside the small stamp button without wrapping.
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// Click-to-stamp End Date, same pattern as the Restore Bike list. Setting
// the date also marks the job Completed; clearing it puts it back to
// Pending — see setWalkInEndDateAction.
function EndDateCell({ job, editable }: { job: RepairJob; editable: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { showError, toastNode } = useToast();
  const date = job.completedDate;

  function handleClick() {
    startTransition(async () => {
      try {
        await setWalkInEndDateAction(job.id, job.branch, date ? null : new Date().toISOString().slice(0, 10));
      } catch (err) {
        showError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {toastNode}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || !editable}
        title={date ? `${formatDate(date)} — click to clear` : "Click to mark done today"}
        className={`flex items-center justify-center w-8 h-8 rounded-lg border text-[10px] font-semibold transition-colors disabled:opacity-50 ${
          date
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
            : "bg-neutral-50 border-neutral-200 text-neutral-400 hover:border-red-300 hover:text-red-600"
        }`}
      >
        {date ? <Check size={13} /> : "End"}
      </button>
      <span className="text-[9px] text-neutral-500 whitespace-nowrap">{date ? shortDate(date) : " "}</span>
    </div>
  );
}

function WalkInRow({
  job,
  showBranch,
  mechanicLabel,
  editable,
  canEdit,
  canResolveErrors,
  highlight,
  selected,
  onToggleSelect,
}: {
  job: RepairJob;
  showBranch: boolean;
  mechanicLabel: string;
  editable: boolean;
  canEdit: boolean;
  canResolveErrors: boolean;
  highlight?: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const isSignatureError = job.signatureStatus === "not_detected" && !job.signatureIssueResolved;

  function handleResolveSignature() {
    setResolving(true);
    startTransition(async () => {
      await resolveSignatureIssueAction(job.id, job.branch);
      setResolving(false);
    });
  }
  const days = daysBetween(job.startedDate, job.completedDate ?? new Date().toISOString().slice(0, 10));
  const rowRef = useRef<HTMLTableRowElement>(null);

  // Opens the original scanned photo in a new tab — a signed URL is
  // resolved on click rather than up front, since it expires after an
  // hour and this list can stay open on screen much longer than that.
  async function handleViewPhoto() {
    if (!job.jobsheetPhotoPath || photoPending) return;
    setPhotoPending(true);
    const url = await getJobsheetPhotoUrlAction(job.jobsheetPhotoPath);
    setPhotoPending(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  // Double-click anywhere on the row (except an actual link/button, which
  // already has its own action) opens the jobsheet's full details.
  function handleRowDoubleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (!canEdit) return;
    if ((e.target as HTMLElement).closest("a, button, input")) return;
    router.push(`/repairs/walk-in/${job.id}/edit`);
  }

  // Deep-linked from a dashboard alert — scroll straight to this job and
  // flash it so it's obvious which row triggered the notice.
  const [flashed, setFlashed] = useState(false);
  useEffect(() => {
    if (!highlight) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashed(true);
    const timeout = setTimeout(() => setFlashed(false), 2500);
    return () => clearTimeout(timeout);
  }, [highlight]);

  function handleDelete() {
    setDeleting(true);
    startTransition(async () => {
      await deleteRepairJobAction(job.id, job.branch);
      setDeleting(false);
      setConfirmOpen(false);
    });
  }

  return (
    <tr
      ref={rowRef}
      onDoubleClick={handleRowDoubleClick}
      title="Double-click to view job details"
      className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors cursor-pointer ${
        flashed ? "bg-sky-50" : ""
      }`}
    >
      {canEdit && (
        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select job ${job.jobNo}`}
            className="accent-red-500"
          />
        </td>
      )}
      <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">{job.jobNo}</td>
      {showBranch && <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{branchLabel(job.branch)}</td>}
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{job.customerName || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.plateNo}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.model || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {mechanicLabel}
          {isHeavyRepairJob(job) && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-700 border-orange-500/20">
              Heavy
            </span>
          )}
        </span>
      </td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(job.revenueAmount)}</td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{job.startedDate ? formatDate(job.startedDate) : "—"}</td>
      <td className="px-5 py-3.5 text-center">
        <EndDateCell job={job} editable={editable} />
      </td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{days ?? 0}d</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
        {job.nextServiceDate ? formatDate(job.nextServiceDate) : "—"}
      </td>
      <td className="px-5 py-3.5 text-center">
        <StatusCell status={job.status} signatureStatus={job.signatureStatus} signatureIssueResolved={job.signatureIssueResolved} />
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1">
          {isSignatureError && canResolveErrors && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleResolveSignature();
              }}
              disabled={resolving}
              className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
              title="Confirm the photo actually shows a customer signature"
            >
              <Check size={12} /> {resolving ? "Confirming…" : "Confirm Signed"}
            </button>
          )}
          {job.jobsheetPhotoPath && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewPhoto();
              }}
              disabled={photoPending}
              className="text-neutral-400 hover:text-red-600 transition-colors p-1 disabled:opacity-50"
              title="View scanned jobsheet photo"
              aria-label="View scanned jobsheet photo"
            >
              <ImageIcon size={14} />
            </button>
          )}
          {canEdit && (
            <Link
              href={`/repairs/walk-in/${job.id}/edit`}
              className="text-neutral-400 hover:text-red-600 transition-colors p-1 inline-block"
              title="Edit job"
              aria-label="Edit job"
            >
              <Pencil size={14} />
            </Link>
          )}
          <Link
            href={`/repairs/walk-in/${job.id}/print`}
            target="_blank"
            className="text-neutral-400 hover:text-red-600 transition-colors p-1 inline-block"
            title="Print job"
            aria-label="Print job"
          >
            <Printer size={14} />
          </Link>
          {canEdit && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="text-neutral-400 hover:text-red-600 transition-colors p-1"
              title="Delete job"
              aria-label="Delete job"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {confirmOpen && (
          <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 text-left">
              <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete this job?</h2>
              <p className="text-sm text-neutral-600 mb-6">
                Job <span className="text-neutral-800 font-medium">{job.jobNo}</span> for{" "}
                <span className="text-neutral-800 font-medium">{job.customerName || job.plateNo}</span> will be
                permanently removed. This can&apos;t be undone.
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
          </div></ModalPortal>
        )}
      </td>
    </tr>
  );
}
