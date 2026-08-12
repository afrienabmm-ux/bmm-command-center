"use client";

import { useState, useTransition } from "react";
import { Plus, Download, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { addRepairJobAction, updateRepairJobAction, updateRepairStatusAction, updateRepairApprovalAction } from "@/lib/repairs-actions";
import { exportRepairJobsCsv } from "@/lib/export-actions";
import {
  JOB_TYPES,
  REPAIR_STATUSES,
  DEAL_TYPES,
  APPROVAL_STATUSES,
  type JobType,
  type RepairStatus,
  type ApprovalStatus,
  type RepairJob,
} from "@/lib/types";
import type { Mechanic } from "@/lib/types";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
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

const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  Pending: "bg-neutral-100 text-neutral-700 border-neutral-300",
  Approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "Not Approved": "bg-red-500/10 text-red-700 border-red-500/20",
};

const OVERDUE_DAYS = 5;

function isOverdue(job: RepairJob): boolean {
  if (job.jobType !== "Restore Bike" || job.status === "Completed") return false;
  const days = daysBetween(job.startedDate, new Date().toISOString().slice(0, 10));
  return (days ?? 0) > OVERDUE_DAYS;
}

export default function RepairsClient({
  active,
  completed,
  mechanics,
  branch,
  branchSelection,
  locked,
}: {
  active: RepairJob[];
  completed: RepairJob[];
  mechanics: Mechanic[];
  branch: Branch;
  branchSelection: BranchSelection;
  locked: boolean;
}) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [typeFilter, setTypeFilter] = useState<JobType | "All">("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<RepairJob | null>(null);
  const [exporting, setExporting] = useState(false);
  const baseJobs = tab === "active" ? active : completed;
  const jobs = typeFilter === "All" ? baseJobs : baseJobs.filter((j) => j.jobType === typeFilter);
  const overdueCount = active.filter(isOverdue).length;

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
          {typeFilter === "Restore Bike" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="font-medium px-5 py-3 whitespace-nowrap">No.</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">PIC</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">N. Plate</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Model</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Tahun</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Condition</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Location</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Start Date</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">End Date</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Cost Restore</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Remark</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Trade In / Jual</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Approval</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <RestoreBikeRow
                    key={job.id}
                    no={i + 1}
                    job={job}
                    branch={branch}
                    mechanicLabel={mechanicLabel(job.mechanicId)}
                    editable={tab === "active"}
                    onEdit={() => setEditingJob(job)}
                  />
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={16} className="px-5 py-10 text-center text-neutral-500 text-sm">
                      {tab === "active" ? "No active" : "No completed"} Restore Bike jobs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Job No.</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Customer</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Plate No.</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Type</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Cost Total</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Trade-in/Sell</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Days</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    branch={branch}
                    mechanicLabel={mechanicLabel(job.mechanicId)}
                    editable={tab === "active"}
                    onEdit={() => setEditingJob(job)}
                  />
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center text-neutral-500 text-sm">
                      {tab === "active" ? "No active" : "No completed"}
                      {typeFilter === "All" ? " repair jobs." : ` ${typeFilter} jobs.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <JobFormModal
          job={null}
          defaultJobType={typeFilter !== "All" ? typeFilter : undefined}
          branchSelection={branchSelection}
          locked={locked}
          mechanics={mechanics}
          onClose={() => setModalOpen(false)}
        />
      )}

      {editingJob && (
        <JobFormModal
          job={editingJob}
          branchSelection={branchSelection}
          locked={locked}
          mechanics={mechanics}
          onClose={() => setEditingJob(null)}
        />
      )}
    </div>
  );
}

function StatusCell({
  job,
  branch,
  editable,
  isPending,
  startTransition,
}: {
  job: RepairJob;
  branch: Branch;
  editable: boolean;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return editable ? (
    <select
      value={job.status}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateRepairStatusAction(job.id, branch, e.target.value as RepairStatus))}
      className={`text-xs font-medium px-2.5 py-1.5 rounded-full border focus:outline-none disabled:opacity-50 ${STATUS_STYLES[job.status]}`}
    >
      {REPAIR_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-neutral-800">
          {s}
        </option>
      ))}
    </select>
  ) : (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[job.status]}`}>{job.status}</span>
  );
}

function ApprovalCell({ job, branch }: { job: RepairJob; branch: Branch }) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      value={job.approvalStatus}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateRepairApprovalAction(job.id, branch, e.target.value as ApprovalStatus))}
      className={`text-xs font-medium px-2.5 py-1.5 rounded-full border focus:outline-none disabled:opacity-50 ${APPROVAL_STYLES[job.approvalStatus]}`}
    >
      {APPROVAL_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-neutral-800">
          {s}
        </option>
      ))}
    </select>
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

function JobRow({
  job,
  branch,
  mechanicLabel,
  editable,
  onEdit,
}: {
  job: RepairJob;
  branch: Branch;
  mechanicLabel: string;
  editable: boolean;
  onEdit: () => void;
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
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.dealType || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{days ?? 0}d</td>
      <td className="px-5 py-3.5">
        <StatusCell job={job} branch={branch} editable={editable} isPending={isPending} startTransition={startTransition} />
      </td>
      <td className="px-5 py-3.5">
        <button onClick={onEdit} className="text-neutral-400 hover:text-indigo-600 transition-colors p-1" title="Edit job" aria-label="Edit job">
          <Pencil size={14} />
        </button>
      </td>
    </tr>
  );
}

function RestoreBikeRow({
  no,
  job,
  branch,
  mechanicLabel,
  editable,
  onEdit,
}: {
  no: number;
  job: RepairJob;
  branch: Branch;
  mechanicLabel: string;
  editable: boolean;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{no}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{job.picName || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.plateNo}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.model || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.bikeYear || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.condition || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{mechanicLabel}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.location || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {formatDate(job.startedDate)}
          <OverdueBadge job={job} />
        </span>
      </td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{job.completedDate ? formatDate(job.completedDate) : "—"}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(job.revenueAmount)}</td>
      <td className="px-5 py-3.5 text-neutral-600 max-w-xs truncate">{job.description || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.dealType || "—"}</td>
      <td className="px-5 py-3.5">
        <ApprovalCell job={job} branch={branch} />
      </td>
      <td className="px-5 py-3.5">
        <StatusCell job={job} branch={branch} editable={editable} isPending={isPending} startTransition={startTransition} />
      </td>
      <td className="px-5 py-3.5">
        <button onClick={onEdit} className="text-neutral-400 hover:text-indigo-600 transition-colors p-1" title="Edit job" aria-label="Edit job">
          <Pencil size={14} />
        </button>
      </td>
    </tr>
  );
}

type ItemInput = { description: string; quantity: string; price: string };

function emptyItem(): ItemInput {
  return { description: "", quantity: "1", price: "" };
}

function itemsFromJob(job: RepairJob): ItemInput[] {
  return job.items.map((i) => ({ description: i.description, quantity: String(i.quantity), price: String(i.price) }));
}

function ItemsEditor({ items, onChange }: { items: ItemInput[]; onChange: (items: ItemInput[]) => void }) {
  function update(i: number, patch: Partial<ItemInput>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addRow() {
    onChange([...items, emptyItem()]);
  }
  function removeRow(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Parts / Items</label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_50px_80px_auto] gap-2 items-center">
            <input
              type="text"
              value={it.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="e.g. Engine Oil"
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            <input
              type="number"
              min={0}
              value={it.quantity}
              onChange={(e) => update(i, { quantity: e.target.value })}
              placeholder="Qty"
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            <input
              type="number"
              min={0}
              value={it.price}
              onChange={(e) => update(i, { price: e.target.value })}
              placeholder="Price"
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-neutral-400 hover:text-red-600 transition-colors p-1"
              aria-label="Remove item"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-2 transition-colors"
      >
        <Plus size={13} /> Add Item
      </button>
      {items.length > 0 && (
        <p className="text-xs text-neutral-500 mt-2">
          Total from items: <span className="font-semibold text-neutral-800">{formatCurrency(total)}</span>
        </p>
      )}
    </div>
  );
}

function JobFormModal({
  job,
  defaultJobType,
  branchSelection,
  locked,
  mechanics,
  onClose,
}: {
  job: RepairJob | null;
  defaultJobType?: JobType;
  branchSelection: BranchSelection;
  locked: boolean;
  mechanics: Mechanic[];
  onClose: () => void;
}) {
  const isEdit = job !== null;
  const [customerName, setCustomerName] = useState(job?.customerName ?? "");
  const [plateNo, setPlateNo] = useState(job?.plateNo ?? "");
  const [jobType, setJobType] = useState<JobType>(job?.jobType ?? defaultJobType ?? "Walk-in");
  const [locationBranch, setLocationBranch] = useState<BranchSelection>(job?.branch ?? branchSelection);
  const [mechanicId, setMechanicId] = useState(job?.mechanicId ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [revenueAmount, setRevenueAmount] = useState(job ? String(job.revenueAmount) : "");
  const [dealType, setDealType] = useState<(typeof DEAL_TYPES)[number]>(
    (job?.dealType as (typeof DEAL_TYPES)[number]) || "Sell"
  );
  const [customDealType, setCustomDealType] = useState(
    job?.dealType && !DEAL_TYPES.includes(job.dealType as (typeof DEAL_TYPES)[number]) ? job.dealType : ""
  );
  const [startedDate, setStartedDate] = useState(job?.startedDate ?? new Date().toISOString().slice(0, 10));
  const [picName, setPicName] = useState(job?.picName ?? "");
  const [model, setModel] = useState(job?.model ?? "");
  const [bikeYear, setBikeYear] = useState(job?.bikeYear ?? "");
  const [condition, setCondition] = useState(job?.condition ?? "");
  const [stockOrderDate, setStockOrderDate] = useState(job?.stockOrderDate ?? "");
  const [stockArriveDate, setStockArriveDate] = useState(job?.stockArriveDate ?? "");
  const [preparedBy, setPreparedBy] = useState(job?.preparedBy ?? "");
  const [items, setItems] = useState<ItemInput[]>(job ? itemsFromJob(job) : []);
  const [isPending, startTransition] = useTransition();
  const isRestoreBike = jobType === "Restore Bike";

  const branchMechanics = locationBranch === "all" ? mechanics : mechanics.filter((m) => m.branch === locationBranch);
  const selectedMechanic = branchMechanics.find((m) => m.id === mechanicId) ?? null;
  const effectiveBranch: Branch | null = locationBranch !== "all" ? locationBranch : (selectedMechanic?.branch ?? null);

  const itemsTotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  function handleLocationChange(next: BranchSelection) {
    setLocationBranch(next);
    setMechanicId("");
  }

  const canSave = customerName.trim() !== "" && plateNo.trim() !== "" && effectiveBranch !== null;

  function handleSave() {
    if (!canSave || !effectiveBranch) return;
    const cleanItems = items
      .filter((it) => it.description.trim() !== "")
      .map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
      }));

    const payload = {
      customerName: customerName.trim(),
      plateNo: plateNo.trim(),
      mechanicId: mechanicId || null,
      description: description.trim(),
      revenueAmount: Number(revenueAmount) || 0,
      dealType: isRestoreBike ? (dealType === "Others" ? customDealType.trim() : dealType) : "",
      startedDate,
      picName: picName.trim(),
      model: model.trim(),
      bikeYear: bikeYear.trim(),
      condition: condition.trim(),
      location: branchLabel(effectiveBranch),
      items: cleanItems,
      stockOrderDate: stockOrderDate || null,
      stockArriveDate: stockArriveDate || null,
      preparedBy: preparedBy.trim(),
    };

    startTransition(async () => {
      if (isEdit && job) {
        await updateRepairJobAction(job.id, job.branch, payload);
      } else {
        await addRepairJobAction({ ...payload, branch: effectiveBranch, jobType });
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">{isEdit ? "Edit Repair Job" : "Add Repair Job"}</h2>
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
              disabled={isEdit}
              onChange={(e) => setJobType(e.target.value as JobType)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
            >
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">PIC</label>
            <input
              type="text"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Tahun</label>
              <input
                type="text"
                value={bikeYear}
                onChange={(e) => setBikeYear(e.target.value)}
                placeholder="e.g. 2019"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Condition</label>
            <input
              type="text"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g. Engine damaged, needs full service"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Location</label>
            <select
              value={locationBranch}
              disabled={locked}
              onChange={(e) => handleLocationChange(e.target.value as BranchSelection)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
              {!locked && <option value="all">All Branches</option>}
            </select>
            {locationBranch === "all" && !selectedMechanic && (
              <p className="text-xs text-amber-700 mt-1.5">Pick a mechanic below to set which branch this job belongs to.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mechanic</label>
            <select
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="">Unassigned</option>
              {branchMechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortName} ({m.shortCode})
                  {locationBranch === "all" ? ` — ${branchLabel(m.branch)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <ItemsEditor items={items} onChange={setItems} />

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">{isRestoreBike ? "Remark" : "Description"}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">{isRestoreBike ? "Cost Restore (RM)" : "Cost Total (RM)"}</label>
              <input
                type="number"
                min={0}
                value={items.length > 0 ? itemsTotal.toFixed(2) : revenueAmount}
                disabled={items.length > 0}
                onChange={(e) => setRevenueAmount(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
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
          {isRestoreBike && (
            <>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Trade-in / Sell</label>
                <select
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value as (typeof DEAL_TYPES)[number])}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                >
                  {DEAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {dealType === "Others" && (
                  <input
                    type="text"
                    value={customDealType}
                    onChange={(e) => setCustomDealType(e.target.value)}
                    placeholder="Type what it is"
                    className="w-full mt-2 bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Stock Order Date</label>
                  <input
                    type="date"
                    value={stockOrderDate}
                    onChange={(e) => setStockOrderDate(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Stock Arrive Date</label>
                  <input
                    type="date"
                    value={stockArriveDate}
                    onChange={(e) => setStockArriveDate(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Prepared By</label>
                <input
                  type="text"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </>
          )}
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
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Job"}
          </button>
        </div>
      </div>
    </div>
  );
}
