"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Pencil, AlertTriangle, Search, Check, Trash2, Printer, Eye, X, ArrowUpDown, ChevronDown } from "lucide-react";
import {
  updateRepairApprovalAction,
  setRestoreBikeWorkflowDateAction,
  setQcResultAction,
  setQcFailFollowupAction,
  updateRepairRemarkAction,
  deleteRepairJobAction,
} from "@/lib/repairs-actions";
import {
  APPROVAL_STATUSES,
  type RepairStatus,
  type ApprovalStatus,
  type QcResult,
  type RepairJob,
} from "@/lib/types";
import type { Mechanic } from "@/lib/types";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency, formatDate, daysBetween, toCsv } from "@/lib/format";
import { useToast } from "@/lib/useToast";
import ModalPortal from "@/components/ModalPortal";

const STATUS_STYLES: Record<RepairStatus, string> = {
  Pending: "bg-neutral-100 text-neutral-700 border-neutral-300",
  "In Progress": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  QC: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  Pending: "bg-neutral-100 text-neutral-700 border-neutral-300",
  Approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "Not Approved": "bg-red-500/10 text-red-700 border-red-500/20",
};

const OVERDUE_DAYS = 5;
const QC_OVERDUE_DAYS = 3;

function isOverdue(job: RepairJob): boolean {
  if (job.status === "Completed") return false;
  const days = daysBetween(job.startedDate, new Date().toISOString().slice(0, 10));
  return (days ?? 0) > OVERDUE_DAYS;
}

function isQcOverdue(job: RepairJob): boolean {
  const days = daysBetween(job.completedDate, new Date().toISOString().slice(0, 10));
  return (days ?? 0) > QC_OVERDUE_DAYS;
}

export default function RepairsClient({
  active,
  qc,
  completed,
  mechanics,
  branchSelection,
  isManagement,
  highlightId,
}: {
  active: RepairJob[];
  qc: RepairJob[];
  completed: RepairJob[];
  mechanics: Mechanic[];
  branchSelection: BranchSelection;
  isManagement: boolean;
  highlightId?: string;
}) {
  const [tab, setTab] = useState<"active" | "qc" | "completed">("active");
  const { toastNode } = useToast();

  // Deep-linked from a dashboard alert (e.g. "ready to start") — jump to
  // whichever sub-tab the highlighted job is actually in, since it isn't
  // always "active".
  useEffect(() => {
    if (!highlightId) return;
    if (active.some((j) => j.id === highlightId)) setTab("active");
    else if (qc.some((j) => j.id === highlightId)) setTab("qc");
    else if (completed.some((j) => j.id === highlightId)) setTab("completed");
  }, [highlightId, active, qc, completed]);
  const [exportJobModalOpen, setExportJobModalOpen] = useState(false);
  const [exportRestoreModalOpen, setExportRestoreModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportMenuOpen]);
  const tabJobs = tab === "active" ? active : tab === "qc" ? qc : completed;
  const jobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? tabJobs.filter(
          (j) =>
            j.plateNo.toLowerCase().includes(q) ||
            (j.picName ?? "").toLowerCase().includes(q) ||
            j.jobNo.toLowerCase().includes(q)
        )
      : tabJobs;
    const dateOf = (j: RepairJob) => j.completedDate || j.startedDate || j.formDate || j.createdAt || "";
    return [...filtered].sort((a, b) =>
      sortDir === "desc" ? dateOf(b).localeCompare(dateOf(a)) : dateOf(a).localeCompare(dateOf(b))
    );
  }, [tabJobs, query, sortDir]);
  const overdueCount = active.filter(isOverdue).length;
  const overdueQcCount = qc.filter(isQcOverdue).length;
  const allJobs = useMemo(() => [...active, ...qc, ...completed], [active, qc, completed]);
  const showBranchColumn = branchSelection === "all";

  function mechanicLabel(id: string | null) {
    if (!id) return "—";
    const m = mechanics.find((m) => m.id === id);
    return m ? `${m.shortName} (${m.shortCode})` : "—";
  }

  function handleExportSingleJob(job: RepairJob) {
    const rows: (string | number)[][] =
      job.items.length > 0
        ? job.items.map((item) => [
            job.jobNo,
            job.customerName || "—",
            job.plateNo,
            job.jobType,
            job.status,
            item.description,
            item.quantity,
            item.price.toFixed(2),
            (item.quantity * item.price).toFixed(2),
          ])
        : [[job.jobNo, job.customerName || "—", job.plateNo, job.jobType, job.status, "—", "", "", ""]];
    rows.push(["", "", "", "", "", "", "", "Total", job.revenueAmount.toFixed(2)]);
    const csv = toCsv(
      ["Job No", "Customer", "Plate No", "Job Type", "Status", "Item Description", "Qty", "Price (RM)", "Line Total (RM)"],
      rows
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bmm-repair-job-${job.jobNo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportJobModalOpen(false);
  }

  function handleExportRestoreBikeJobs(matches: RepairJob[]) {
    const rows = matches.map((j, i) => [
      i + 1,
      j.picName,
      j.plateNo,
      j.model,
      j.bikeYear,
      j.condition,
      mechanicLabel(j.mechanicId),
      j.location,
      j.startedDate ? formatDate(j.startedDate) : "",
      j.completedDate ? formatDate(j.completedDate) : "",
      j.revenueAmount.toFixed(2),
      j.approvalStatus,
      j.dealType,
      j.remark,
      j.status,
    ]);
    const csv = toCsv(
      [
        "No.",
        "PIC",
        "N. Plate",
        "Model",
        "Tahun",
        "Condition",
        "Mechanic",
        "Location",
        "Start Date",
        "End Date",
        "Cost Restore (RM)",
        "Approval",
        "Trade In / Tarik",
        "Remark",
        "Status",
      ],
      rows
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bmm-restore-bike-${branchSelection}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportRestoreModalOpen(false);
  }

  return (
    <div>
      {toastNode}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={17} className="text-red-600" />
          </div>
          <p className="text-sm font-semibold text-red-700">
            {overdueCount} Restore Bike job{overdueCount === 1 ? "" : "s"} running past {OVERDUE_DAYS} days — check if it's finished
          </p>
        </div>
      )}

      {overdueQcCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={17} className="text-red-600" />
          </div>
          <p className="text-sm font-semibold text-red-700">
            {overdueQcCount} job{overdueQcCount === 1 ? "" : "s"} waiting on QC past {QC_OVERDUE_DAYS} days — check the QC tab
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-white border border-neutral-200 rounded-lg p-1">
          <button
            onClick={() => setTab("active")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "active" ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Active ({active.length})
          </button>
          <button
            onClick={() => setTab("qc")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              tab === "qc" ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            QC ({qc.length}){overdueQcCount > 0 && tab !== "qc" && <span className="ml-1 text-red-600">●</span>}
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "completed" ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Completed ({completed.length})
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search job no., plate, or PIC…"
              className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-56"
            />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            title="Sort by date"
          >
            <ArrowUpDown size={14} /> {sortDir === "desc" ? "Newest" : "Oldest"}
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download size={15} /> Export
              <ChevronDown size={14} className={`transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {exportMenuOpen && (
              <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-neutral-200 rounded-xl shadow-lg py-1.5 w-56">
                {allJobs.length > 0 && (
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      setExportRestoreModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                  >
                    <Download size={14} /> Export All / Filtered…
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
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th className="font-medium px-5 py-3 whitespace-nowrap">Date</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Thumbprint</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Plate</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Model</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Tahun</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mileage</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Condition</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Cost Restore</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Approval</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Trade In / Tarik / Jual</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Remark</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Part Order</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Part Arrive</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Start Date</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">End Date</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Status</th>
                {tab === "qc" && <th className="font-medium px-5 py-3 whitespace-nowrap text-center">QC Result</th>}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => (
                <RestoreBikeRow
                  key={job.id}
                  no={i + 1}
                  job={job}
                  showBranch={showBranchColumn}
                  editable={tab === "active"}
                  showQc={tab === "qc"}
                  isManagement={isManagement}
                  highlight={job.id === highlightId}
                  mechanicLabel={mechanicLabel}
                />
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td
                    colSpan={19 + (tab === "qc" ? 1 : 0)}
                    className="px-5 py-10 text-center text-neutral-500 text-sm"
                  >
                    {tabJobs.length === 0
                      ? `${tab === "active" ? "No active" : tab === "qc" ? "No jobs waiting on QC" : "No completed"} Restore Bike jobs.`
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

      {exportRestoreModalOpen && (
        <ExportRestoreBikeModal
          jobs={allJobs}
          mechanics={mechanics}
          onExport={handleExportRestoreBikeJobs}
          onClose={() => setExportRestoreModalOpen(false)}
        />
      )}
    </div>
  );
}

function ExportRestoreBikeModal({
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
      if (q && !(j.plateNo.toLowerCase().includes(q) || j.jobNo.toLowerCase().includes(q) || j.picName.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [jobs, mechanicId, query]);

  const hasFilters = mechanicId !== "all" || query.trim() !== "";

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Export Restore Bike Jobs</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Export every Restore Bike job, or narrow it down by mechanic, job no., plate no. or PIC name first.
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Job No. / Plate No. / PIC</label>
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
          {matches.length} of {jobs.length} Restore Bike job{jobs.length === 1 ? "" : "s"} match
          {hasFilters ? " your filters" : ""}.
        </p>
        <div className="max-h-56 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100 mb-4">
          {matches.length === 0 && <p className="text-sm text-neutral-500 text-center py-6">No matching jobs.</p>}
          {matches.map((job) => (
            <div key={job.id} className="px-4 py-2.5">
              <p className="text-sm font-medium text-neutral-800">{job.jobNo} — {job.plateNo}</p>
              <p className="text-xs text-neutral-500">PIC: {job.picName || "—"}</p>
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
                <p className="text-xs text-neutral-500">{job.jobType} · {job.items.length} item{job.items.length === 1 ? "" : "s"} · {formatCurrency(job.revenueAmount)}</p>
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

// Status is no longer a manual choice — it just follows the Start/End
// stamps (see setRestoreBikeWorkflowDateAction), so this is read-only.
// The follow-up stamp is the one exception: a QC failure needs a PIC to
// actually confirm they looked into it (the server blocks re-submitting to
// QC otherwise — see setRestoreBikeWorkflowDateAction's "completed" gate).
function StatusCell({ job, editable }: { job: RepairJob; editable: boolean }) {
  const [isPending, startTransition] = useTransition();
  const needsFollowup = job.qcResult === "Failed" && !!job.qcFailReason;

  function toggleFollowup() {
    startTransition(async () => {
      await setQcFailFollowupAction(
        job.id,
        job.branch,
        job.qcFailFollowupDate ? null : new Date().toISOString().slice(0, 10)
      );
    });
  }

  return (
    <div className="flex flex-col gap-1 items-center">
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[job.status]}`}>{job.status}</span>
      {job.qcResult && (
        <span
          title={job.qcResult === "Failed" ? job.qcFailReason ?? undefined : undefined}
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            job.qcResult === "Passed"
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
              : "bg-red-500/10 text-red-700 border-red-500/20"
          }`}
        >
          QC {job.qcResult}
        </span>
      )}
      {job.qcResult === "Failed" && job.qcFailReason && (
        <span className="text-[10px] text-red-600 max-w-[160px]">{job.qcFailReason}</span>
      )}
      {needsFollowup && (
        <button
          type="button"
          onClick={toggleFollowup}
          disabled={isPending || !editable}
          title={job.qcFailFollowupDate ? `Followed up ${formatDate(job.qcFailFollowupDate)} — click to clear` : "Click once you've followed up on the QC failure"}
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
            job.qcFailFollowupDate
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
              : "bg-amber-500/10 border-amber-500/30 text-amber-700 hover:border-amber-400"
          }`}
        >
          {job.qcFailFollowupDate ? `Followed up ${formatDate(job.qcFailFollowupDate)}` : "Mark followed up"}
        </button>
      )}
    </div>
  );
}

// Pass sends the job straight to Completed; Fail sends it back to Active
// (clearing the End Date) so the mechanic can redo it — the server handles
// both transitions in setQcResultAction. Picking the current placeholder
// option again is a no-op since there's nothing to select back to.
// Failing QC requires a reason — a small modal collects it before the
// action fires, rather than silently sending the job back to the
// mechanic with no record of what was wrong.
function QcFailReasonModal({ job, onClose }: { job: RepairJob; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showError, toastNode } = useToast();

  function handleConfirm() {
    if (reason.trim() === "") return;
    startTransition(async () => {
      const result = await setQcResultAction(job.id, job.branch, "Failed", reason);
      if (result && "error" in result) {
        showError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      {toastNode}
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 text-left">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Why did this fail QC?</h2>
        <p className="text-sm text-neutral-600 mb-3">
          {job.plateNo} — {job.model || "—"}
        </p>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Brake still loose, redo engine mount"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 resize-none"
        />
        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || reason.trim() === ""}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : "Fail QC"}
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}

function QcResultCell({ job }: { job: RepairJob }) {
  const [isPending, startTransition] = useTransition();
  const [failModalOpen, setFailModalOpen] = useState(false);
  const { showError, toastNode } = useToast();

  function handleChange(value: string) {
    if (value === "Failed") {
      setFailModalOpen(true);
      return;
    }
    if (value !== "Passed") return;
    startTransition(async () => {
      const result = await setQcResultAction(job.id, job.branch, "Passed");
      if (result && "error" in result) showError(result.error);
    });
  }

  return (
    <>
      {toastNode}
      <div className="relative inline-block">
        <select
          value=""
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          className="appearance-none text-xs font-medium bg-white border border-neutral-200 hover:border-red-300 rounded-xl pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="" disabled>
            Pass or fail?
          </option>
          <option value="Passed">Pass</option>
          <option value="Failed">Fail</option>
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
      </div>
      {failModalOpen && <QcFailReasonModal job={job} onClose={() => setFailModalOpen(false)} />}
    </>
  );
}

// Click-to-cycle through Pending -> Approved -> Not Approved -> Pending,
// same click-button pattern as the workflow stamps instead of a dropdown.
// Only Management (the GM) can actually change this — a branch PIC sees
// the same badge but it's not clickable, since gating the Start button on
// GM approval only means something if the PIC can't just approve their
// own job.
function ApprovalCell({ job, canApprove }: { job: RepairJob; canApprove: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (!canApprove) {
    return (
      <span className={`text-xs font-medium px-2.5 py-1.5 rounded-full border inline-block ${APPROVAL_STYLES[job.approvalStatus]}`}>
        {job.approvalStatus}
      </span>
    );
  }

  function handleChange(value: string) {
    startTransition(() => updateRepairApprovalAction(job.id, value as ApprovalStatus));
  }

  return (
    <select
      value={job.approvalStatus}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className={`text-xs font-medium pl-2.5 pr-6 py-1.5 rounded-full border transition-colors disabled:opacity-50 cursor-pointer ${APPROVAL_STYLES[job.approvalStatus]}`}
    >
      {APPROVAL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

// Restore Bike workflow tracker: five click-to-stamp milestones. The first
// three (Arrived/Quotation/GM Approved) stamp today's date inline and clear
// on a second click. The last two (Repair Start/Last) aren't separate
// fields — they link straight to the job's own Started Date/End Date boxes
// on the edit form, so there's only ever one place those dates live.
// e.g. "17/8" — short enough to sit under a 32px-wide button without
// wrapping, unlike formatDate's full "17 Aug 2026".
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function StageButton({
  label,
  date,
  onClick,
  disabled,
  title,
}: {
  label: string;
  date: string | null;
  onClick: () => void;
  disabled: boolean;
  title?: string;
}) {
  const defaultTitle = date ? `${formatDate(date)} — click to clear` : `Click to mark done today`;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title ?? defaultTitle}
        className={`flex items-center justify-center w-8 h-8 rounded-lg border text-[10px] font-semibold transition-colors disabled:opacity-50 ${
          date
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
            : "bg-neutral-50 border-neutral-200 text-neutral-400 hover:border-red-300 hover:text-red-600"
        }`}
      >
        {date ? <Check size={13} /> : label}
      </button>
      <span className="text-[9px] text-neutral-500 whitespace-nowrap">{date ? shortDate(date) : " "}</span>
    </div>
  );
}

// Arrived is stamped automatically when the job is created via "Bike
// Arrived" (or filled in on the form for jobs added the old way) — shown
// read-only here rather than as a click target like the other stages.
function ArrivedCell({ job }: { job: RepairJob }) {
  return <StageButton label="Arr" date={job.arrivedDate} onClick={() => {}} disabled title={job.arrivedDate ? formatDate(job.arrivedDate) : "Not recorded"} />;
}

// A real date picker instead of a click-to-stamp button — lets the PIC
// record the actual day a part was ordered/arrived or a repair started,
// not just "today", e.g. logging yesterday's delivery after the fact.
function DatePickerCell({
  date,
  onChange,
  disabled,
  title,
}: {
  date: string | null;
  onChange: (value: string) => void;
  disabled: boolean;
  title?: string;
}) {
  const defaultTitle = date ? `${formatDate(date)} — click to change` : "Click to pick a date";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <input
        type="date"
        value={date ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        title={title ?? defaultTitle}
        className={`date-icon-only w-8 h-8 rounded-lg border transition-colors disabled:opacity-50 ${
          date ? "bg-emerald-500/10 border-emerald-500/30" : "bg-neutral-50 border-neutral-200 hover:border-red-300"
        }`}
      />
      <span className="text-[9px] text-neutral-500 whitespace-nowrap">{date ? shortDate(date) : " "}</span>
    </div>
  );
}

// Stock Order/Arrival date cells — no gating of their own, but Start
// (below) won't unlock until both of these are set.
function StockDateCell({
  job,
  branch,
  stage,
  editable,
}: {
  job: RepairJob;
  branch: Branch;
  stage: "stockOrder" | "stockArrive";
  editable: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const date = stage === "stockOrder" ? job.stockOrderDate : job.stockArriveDate;
  function handleChange(value: string) {
    startTransition(async () => {
      await setRestoreBikeWorkflowDateAction(job.id, branch, stage, value || null);
    });
  }
  return <DatePickerCell date={date} onChange={handleChange} disabled={isPending || !editable} />;
}

// Repair Start/Last click-to-stamp cells. Start is hard-gated on the
// existing Approval status; Last isn't gated, but the server refuses to set
// a date if the job hasn't started yet — shown here as a warning alert
// rather than silently failing.
function RepairDateCell({
  job,
  stage,
  editable,
}: {
  job: RepairJob;
  stage: "started" | "completed";
  editable: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const { showError, toastNode } = useToast();
  const date = stage === "started" ? job.startedDate : job.completedDate;
  const missingStockDates = stage === "started" && (!job.stockOrderDate || !job.stockArriveDate);
  // Not blocked by approval/stock-date state here — clicking still fires,
  // and the server's rejection surfaces as an alert below, so the PIC gets
  // an explicit "get approval first" message instead of a dead button.
  const disabled = isPending || !editable;
  const title =
    stage === "started" && job.approvalStatus !== "Approved"
      ? "This job needs GM approval (see the Approval column) before the repair can start"
      : stage === "started" && missingStockDates
        ? "Set the Stock Order date and Stock Arrival date before starting the repair"
        : undefined;

  function handleChange(value: string) {
    startTransition(async () => {
      const result = await setRestoreBikeWorkflowDateAction(job.id, job.branch, stage, value || null);
      if (result && "error" in result) {
        showError(result.error);
      }
    });
  }

  function handleClick() {
    startTransition(async () => {
      const result = await setRestoreBikeWorkflowDateAction(
        job.id,
        job.branch,
        stage,
        date ? null : new Date().toISOString().slice(0, 10)
      );
      if (result && "error" in result) {
        showError(result.error);
      }
    });
  }

  return (
    <>
      {toastNode}
      {stage === "started" ? (
        <DatePickerCell date={date} onChange={handleChange} disabled={disabled} title={title} />
      ) : (
        <StageButton label="En" date={date} onClick={handleClick} disabled={disabled} title={title} />
      )}
    </>
  );
}

// So the GM can see what a Restore Bike's cost is actually made up of —
// which items, quantities, and prices — without opening the full edit form.
function ItemsDetailModal({ job, onClose }: { job: RepairJob; onClose: () => void }) {
  const itemsTotal = job.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-6 pb-0 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Restore Bike Costing</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {job.plateNo} — {job.picName || "—"} {job.model ? `· ${job.model}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
        <div className="mt-4 border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200 bg-neutral-50">
                <th className="font-medium px-3 py-2">Code</th>
                <th className="font-medium px-3 py-2">Item</th>
                <th className="font-medium px-3 py-2 text-right">Qty</th>
                <th className="font-medium px-3 py-2 text-right">Price</th>
                <th className="font-medium px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {job.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-500 text-sm">
                    No items listed for this job.
                  </td>
                </tr>
              )}
              {job.items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{item.code || "—"}</td>
                  <td className="px-3 py-2 text-neutral-800">{item.description || "—"}</td>
                  <td className="px-3 py-2 text-right text-neutral-600">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-neutral-600 whitespace-nowrap">{formatCurrency(item.price)}</td>
                  <td className="px-3 py-2 text-right text-neutral-800 font-medium whitespace-nowrap">
                    {formatCurrency(item.quantity * item.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs text-neutral-500">
            {job.items.length > 0 && itemsTotal !== job.revenueAmount ? "Items total vs. recorded cost restore" : "Total Cost Restore"}
          </span>
          <span className="text-base font-semibold text-neutral-900">{formatCurrency(job.revenueAmount)}</span>
        </div>
        {job.items.length > 0 && itemsTotal !== job.revenueAmount && (
          <p className="text-xs text-neutral-500 text-right px-1">Items sum to {formatCurrency(itemsTotal)}</p>
        )}
        </div>

        <div className="flex items-center justify-end p-6 pt-4 shrink-0 border-t border-neutral-100">
          <button onClick={onClose} className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}

// Free-text note the PIC types straight into the list — saves on blur (or
// Enter), same click-to-edit feel as the date/status cells beside it.
function RemarkCell({ job, editable }: { job: RepairJob; editable: boolean }) {
  const [value, setValue] = useState(job.remark);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value === job.remark) return;
    startTransition(async () => {
      await updateRepairRemarkAction(job.id, job.branch, value);
    });
  }

  if (!editable) {
    return <span className="text-neutral-600 whitespace-nowrap">{job.remark || "—"}</span>;
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      disabled={isPending}
      placeholder="Add a remark…"
      className="w-40 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-50"
    />
  );
}

function OverdueBadge({ job }: { job: RepairJob }) {
  if (!isOverdue(job)) return null;
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
      <AlertTriangle size={10} /> Overdue
    </span>
  );
}


function RestoreBikeRow({
  no,
  job,
  showBranch,
  editable,
  showQc,
  isManagement,
  highlight,
  mechanicLabel,
}: {
  no: number;
  job: RepairJob;
  showBranch: boolean;
  editable: boolean;
  showQc: boolean;
  isManagement: boolean;
  highlight?: boolean;
  mechanicLabel: (id: string | null) => string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rowRef = useRef<HTMLTableRowElement>(null);

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
      className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors ${
        flashed ? "bg-emerald-50" : ""
      }`}
    >
      <td className="px-5 py-3.5 text-center">
        <ArrivedCell job={job} />
      </td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{no}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {job.picName || "—"}
          {showBranch && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-neutral-100 text-neutral-500 border-neutral-200">
              {branchLabel(job.branch)}
            </span>
          )}
        </span>
      </td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{mechanicLabel(job.mechanicId)}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.plateNo}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.model || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.bikeYear || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.mileageKm || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.condition || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(job.revenueAmount)}</td>
      <td className="px-5 py-3.5 text-center">
        <ApprovalCell job={job} canApprove={isManagement} />
      </td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap text-center">{job.dealType || "—"}</td>
      <td className="px-5 py-3.5">
        <RemarkCell job={job} editable={editable} />
      </td>
      <td className="px-5 py-3.5 text-center">
        <StockDateCell job={job} branch={job.branch} stage="stockOrder" editable={editable} />
      </td>
      <td className="px-5 py-3.5 text-center">
        <StockDateCell job={job} branch={job.branch} stage="stockArrive" editable={editable} />
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className="inline-flex items-center gap-1.5">
          <RepairDateCell job={job} stage="started" editable={editable} />
          <OverdueBadge job={job} />
        </span>
      </td>
      <td className="px-5 py-3.5 text-center">
        <RepairDateCell job={job} stage="completed" editable={editable} />
      </td>
      <td className="px-5 py-3.5 text-center">
        <StatusCell job={job} editable={editable} />
      </td>
      {showQc && (
        <td className="px-5 py-3.5 text-center">
          <QcResultCell job={job} />
        </td>
      )}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDetailsOpen(true)}
            className="text-neutral-400 hover:text-red-600 transition-colors p-1"
            title="View costing details"
            aria-label="View costing details"
          >
            <Eye size={14} />
          </button>
          <Link
            href={`/repairs/${job.id}/edit`}
            className="text-neutral-400 hover:text-red-600 transition-colors p-1 inline-block"
            title="Edit job"
            aria-label="Edit job"
          >
            <Pencil size={14} />
          </Link>
          <Link
            href={`/repairs/${job.id}/print`}
            target="_blank"
            className="text-neutral-400 hover:text-red-600 transition-colors p-1 inline-block"
            title="Print job"
            aria-label="Print job"
          >
            <Printer size={14} />
          </Link>
          <button
            onClick={() => setConfirmOpen(true)}
            className="text-neutral-400 hover:text-red-600 transition-colors p-1"
            title="Delete job"
            aria-label="Delete job"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {confirmOpen && (
          <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 text-left">
              <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete this job?</h2>
              <p className="text-sm text-neutral-600 mb-6">
                Job <span className="text-neutral-800 font-medium">{job.jobNo}</span> for{" "}
                <span className="text-neutral-800 font-medium">{job.picName || job.plateNo}</span> will be
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

        {detailsOpen && <ItemsDetailModal job={job} onClose={() => setDetailsOpen(false)} />}
      </td>
    </tr>
  );
}

