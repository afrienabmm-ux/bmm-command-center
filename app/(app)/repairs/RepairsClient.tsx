"use client";

import { useState, useTransition } from "react";
import { Plus, Download } from "lucide-react";
import { addRepairJobAction, updateRepairStatusAction } from "@/lib/repairs-actions";
import { exportRepairJobsCsv } from "@/lib/export-actions";
import { JOB_TYPES, REPAIR_STATUSES, type JobType, type RepairStatus, type RepairJob } from "@/lib/types";
import type { Mechanic } from "@/lib/types";
import type { Branch } from "@/lib/branch";
import { formatCurrency, formatDate, daysBetween } from "@/lib/format";

const JOB_TYPE_STYLES: Record<JobType, string> = {
  "Restore Bike": "bg-purple-500/10 text-purple-700 border-purple-500/20",
  "Walk-in": "bg-sky-500/10 text-sky-700 border-sky-500/20",
};

const STATUS_STYLES: Record<RepairStatus, string> = {
  Pending: "bg-neutral-100 text-neutral-700 border-neutral-300",
  "In Progress": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

export default function RepairsClient({
  active,
  completed,
  mechanics,
  branch,
}: {
  active: RepairJob[];
  completed: RepairJob[];
  mechanics: Mechanic[];
  branch: Branch;
}) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [typeFilter, setTypeFilter] = useState<JobType | "All">("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const baseJobs = tab === "active" ? active : completed;
  const jobs = typeFilter === "All" ? baseJobs : baseJobs.filter((j) => j.jobType === typeFilter);

  function mechanicLabel(id: string | null) {
    if (!id) return "—";
    const m = mechanics.find((m) => m.id === id);
    return m ? `${m.shortName} (${m.shortCode})` : "—";
  }

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportRepairJobsCsv(branch, typeFilter === "All" ? undefined : typeFilter);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = typeFilter === "All" ? "" : `-${typeFilter.toLowerCase().replace(/\s+/g, "-")}`;
      a.download = `bmm-repairs-${branch}${suffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
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
            {exporting
              ? "Exporting…"
              : typeFilter === "All"
                ? "Export to Excel / CSV"
                : `Export ${typeFilter} Only`}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Job
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-neutral-500">Type:</span>
        <div className="flex gap-1 bg-white border border-neutral-200 rounded-lg p-1">
          {(["All", ...JOB_TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                typeFilter === t ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              {t === "All" ? "All Types" : t}
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
                <th className="font-medium px-5 py-3 whitespace-nowrap">Customer</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Plate No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Type</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Revenue</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Days</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} branch={branch} mechanicLabel={mechanicLabel(job.mechanicId)} editable={tab === "active"} />
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    {tab === "active" ? "No active" : "No completed"}
                    {typeFilter === "All" ? " repair jobs." : ` ${typeFilter} jobs.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <AddJobModal branch={branch} mechanics={mechanics} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function JobRow({
  job,
  branch,
  mechanicLabel,
  editable,
}: {
  job: RepairJob;
  branch: Branch;
  mechanicLabel: string;
  editable: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const days = daysBetween(job.startedDate, job.completedDate ?? new Date().toISOString().slice(0, 10));

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">{job.jobNo}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{job.customerName}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.plateNo}</td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${JOB_TYPE_STYLES[job.jobType]}`}>
          {job.jobType}
        </span>
      </td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{mechanicLabel}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(job.revenueAmount)}</td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{days ?? 0}d</td>
      <td className="px-5 py-3.5">
        {editable ? (
          <select
            value={job.status}
            disabled={isPending}
            onChange={(e) =>
              startTransition(() => updateRepairStatusAction(job.id, branch, e.target.value as RepairStatus))
            }
            className={`text-xs font-medium px-2.5 py-1.5 rounded-full border focus:outline-none disabled:opacity-50 ${STATUS_STYLES[job.status]}`}
          >
            {REPAIR_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-white text-neutral-800">
                {s}
              </option>
            ))}
          </select>
        ) : (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[job.status]}`}>
            {job.status}
          </span>
        )}
      </td>
    </tr>
  );
}

function AddJobModal({
  branch,
  mechanics,
  onClose,
}: {
  branch: Branch;
  mechanics: Mechanic[];
  onClose: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [jobType, setJobType] = useState<JobType>("Walk-in");
  const [mechanicId, setMechanicId] = useState("");
  const [description, setDescription] = useState("");
  const [revenueAmount, setRevenueAmount] = useState("");
  const [startedDate, setStartedDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();

  const canSave = customerName.trim() !== "" && plateNo.trim() !== "";

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await addRepairJobAction({
        branch,
        customerName: customerName.trim(),
        plateNo: plateNo.trim(),
        jobType,
        mechanicId: mechanicId || null,
        description: description.trim(),
        revenueAmount: Number(revenueAmount) || 0,
        startedDate,
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Add Repair Job</h2>
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
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Job Type</label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as JobType)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mechanic</label>
            <select
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="">Unassigned</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortName} ({m.shortCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Revenue (RM)</label>
              <input
                type="number"
                min={0}
                value={revenueAmount}
                onChange={(e) => setRevenueAmount(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Started Date</label>
              <input
                type="date"
                value={startedDate}
                onChange={(e) => setStartedDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
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
            Add Job
          </button>
        </div>
      </div>
    </div>
  );
}
