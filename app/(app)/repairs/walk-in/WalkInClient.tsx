"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Download, Pencil, Search, Trash2, Check } from "lucide-react";
import { setWalkInEndDateAction, deleteRepairJobAction } from "@/lib/repairs-actions";
import { isHeavyRepairJob, type RepairStatus, type RepairJob } from "@/lib/types";
import type { Mechanic } from "@/lib/types";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency, formatDate, daysBetween, toCsv } from "@/lib/format";

const STATUS_STYLES: Record<RepairStatus, string> = {
  Pending: "bg-neutral-100 text-neutral-700 border-neutral-300",
  "In Progress": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

export default function WalkInClient({
  active,
  completed,
  mechanics,
  branchSelection,
}: {
  active: RepairJob[];
  completed: RepairJob[];
  mechanics: Mechanic[];
  branchSelection: BranchSelection;
}) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [loadFilter, setLoadFilter] = useState<"All" | "Heavy Repair" | "Normal Repair">("All");
  const [exporting, setExporting] = useState(false);
  const [exportJobModalOpen, setExportJobModalOpen] = useState(false);
  const [exportFilteredModalOpen, setExportFilteredModalOpen] = useState(false);
  const baseJobs = tab === "active" ? active : completed;
  const jobs =
    loadFilter === "All"
      ? baseJobs
      : baseJobs.filter((j) => (loadFilter === "Heavy Repair" ? isHeavyRepairJob(j) : !isHeavyRepairJob(j)));
  const allJobs = useMemo(() => [...active, ...completed], [active, completed]);
  const showBranchColumn = branchSelection === "all";

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

  const HEADERS = ["Job No", "Customer", "Plate No", "Model", "Mechanic", "Cost Total (RM)", "Started Date", "Completed Date", "Days Taken", "Status"];

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
          <button
            onClick={() => setTab("active")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "active" ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Active ({active.length})
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "completed" ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Completed ({completed.length})
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download size={15} />
            {exporting ? "Exporting…" : "Export to Excel / CSV"}
          </button>
          <button
            onClick={() => setExportJobModalOpen(true)}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <Search size={15} /> Export One Job (with items)
          </button>
          {allJobs.length > 0 && (
            <button
              onClick={() => setExportFilteredModalOpen(true)}
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download size={15} /> Export Filtered…
            </button>
          )}
          <Link
            href="/repairs/walk-in/new"
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Job
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-medium text-neutral-500">Load:</span>
        <div className="flex gap-1 bg-white border border-neutral-200 rounded-lg p-1">
          {(["All", "Heavy Repair", "Normal Repair"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLoadFilter(l)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                loadFilter === l ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              {l === "All" ? "All" : l}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th className="font-medium px-5 py-3 whitespace-nowrap">Job No.</th>
                {showBranchColumn && <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>}
                <th className="font-medium px-5 py-3 whitespace-nowrap">Customer</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Plate No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Model</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Cost Total</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Start Date</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">End Date</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Days</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <WalkInRow
                  key={job.id}
                  job={job}
                  showBranch={showBranchColumn}
                  mechanicLabel={mechanicLabel(job.mechanicId)}
                  editable={tab === "active"}
                />
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={showBranchColumn ? 12 : 11} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    {tab === "active" ? "No active" : "No completed"} Walk-in jobs.
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Export Walk-in Jobs</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Export every Walk-in job, or narrow it down by mechanic, job no., plate no. or customer name first.
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mechanic</label>
            <select
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="all">All Mechanics</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortName} ({m.shortCode})
                </option>
              ))}
            </select>
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
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mb-2">
          {matches.length} of {jobs.length} Walk-in job{jobs.length === 1 ? "" : "s"} match
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
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={15} /> {hasFilters ? `Export ${matches.length} Filtered` : "Export All"}
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
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
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
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
    </div>
  );
}

// Status is no longer a manual choice here — it just follows the End Date
// stamp (see EndDateCell), so this is read-only.
function StatusCell({ status }: { status: RepairStatus }) {
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[status]}`}>{status}</span>;
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
  const date = job.completedDate;

  function handleClick() {
    startTransition(async () => {
      try {
        await setWalkInEndDateAction(job.id, job.branch, date ? null : new Date().toISOString().slice(0, 10));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || !editable}
        title={date ? `${formatDate(date)} — click to clear` : "Click to mark done today"}
        className={`flex items-center justify-center w-8 h-8 rounded-lg border text-[10px] font-semibold transition-colors disabled:opacity-50 ${
          date
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
            : "bg-neutral-50 border-neutral-200 text-neutral-400 hover:border-indigo-300 hover:text-indigo-600"
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
}: {
  job: RepairJob;
  showBranch: boolean;
  mechanicLabel: string;
  editable: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const days = daysBetween(job.startedDate, job.completedDate ?? new Date().toISOString().slice(0, 10));

  function handleDelete() {
    setDeleting(true);
    startTransition(async () => {
      await deleteRepairJobAction(job.id, job.branch);
      setDeleting(false);
      setConfirmOpen(false);
    });
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
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
      <td className="px-5 py-3.5">
        <EndDateCell job={job} editable={editable} />
      </td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{days ?? 0}d</td>
      <td className="px-5 py-3.5">
        <StatusCell status={job.status} />
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1">
          <Link
            href={`/repairs/walk-in/${job.id}/edit`}
            className="text-neutral-400 hover:text-indigo-600 transition-colors p-1 inline-block"
            title="Edit job"
            aria-label="Edit job"
          >
            <Pencil size={14} />
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
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
          </div>
        )}
      </td>
    </tr>
  );
}
