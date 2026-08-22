"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Pencil, Printer, Trash2, Search, ArrowUpDown, AlertTriangle } from "lucide-react";
import { assignMechanicAction, deleteRepairJobAction, quickAddRestoreBikeArrivalAction } from "@/lib/repairs-actions";
import { isHeavyRepairJob, type RepairJob } from "@/lib/types";
import type { Mechanic } from "@/lib/types";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency, formatDate } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/useToast";

function AddBikeButton({ branch }: { branch: Branch }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const { id } = await quickAddRestoreBikeArrivalAction(branch);
      router.push(`/repairs/${id}/edit`);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      <Plus size={15} /> {isPending ? "Adding…" : "Add Bike"}
    </button>
  );
}

// Assign a mechanic straight from the arrival queue — same busy/heavy-repair
// gate as before (assertMechanicAssignment on the server), just scoped to
// this tab now instead of a column in the main Bikes Listing table. A PIC
// can now assign anyone regardless of how busy they already are — there's
// no server-side block anymore — but picking someone triggers a heads-up
// listing whichever branch mechanics still have zero jobs today, so idle
// mechanics don't get quietly skipped over.
function AssignCell({ job, mechanics, allActiveJobs }: { job: RepairJob; mechanics: Mechanic[]; allActiveJobs: RepairJob[] }) {
  const [isPending, startTransition] = useTransition();
  const { showError, toastNode } = useToast();
  const [idleHeadsUp, setIdleHeadsUp] = useState<string | null>(null);
  const branchMechanics = mechanics.filter((m) => m.branch === job.branch && (!isHeavyRepairJob(job) || m.category === "Heavy Repair"));

  function handleChange(mechanicId: string) {
    if (!mechanicId) return;
    startTransition(async () => {
      const result = await assignMechanicAction(job.id, job.branch, mechanicId);
      if (result && "error" in result) {
        showError(result.error);
        return;
      }
      const busyMechanicIds = new Set(allActiveJobs.filter((j) => j.mechanicId).map((j) => j.mechanicId as string));
      const freeMechanics = mechanics.filter((m) => m.branch === job.branch && m.id !== mechanicId && !busyMechanicIds.has(m.id));
      if (freeMechanics.length > 0) {
        setIdleHeadsUp(
          `${freeMechanics.map((m) => `${m.shortName} (${m.shortCode})`).join(", ")} still ${
            freeMechanics.length === 1 ? "has" : "have"
          } no job today. Make sure they're getting work too so they can chase their daily revenue.`
        );
      }
    });
  }

  return (
    <>
      {toastNode}
      <select
        value=""
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending || branchMechanics.length === 0}
        className="text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
      >
        <option value="">{branchMechanics.length === 0 ? "No mechanics available" : "Assign…"}</option>
        {branchMechanics.map((m) => (
          <option key={m.id} value={m.id}>
            {m.shortName} ({m.shortCode})
          </option>
        ))}
      </select>
      {idleHeadsUp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 text-left">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
              <AlertTriangle size={17} className="text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Heads up</h2>
            <p className="text-sm text-neutral-600">{idleHeadsUp}</p>
            <div className="flex items-center justify-end mt-5">
              <button
                type="button"
                onClick={() => setIdleHeadsUp(null)}
                className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ArrivalRow({
  no,
  job,
  showBranch,
  mechanics,
  allActiveJobs,
}: {
  no: number;
  job: RepairJob;
  showBranch: boolean;
  mechanics: Mechanic[];
  allActiveJobs: RepairJob[];
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{no}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.arrivedDate ? formatDate(job.arrivedDate) : "—"}</td>
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
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.plateNo}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.model || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.bikeYear || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.mileageKm || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{job.condition || "—"}</td>
      <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(job.revenueAmount)}</td>
      <td className="px-5 py-3.5 text-center">
        <AssignCell job={job} mechanics={mechanics} allActiveJobs={allActiveJobs} />
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1">
          <Link
            href={`/repairs/${job.id}/edit`}
            className="text-neutral-400 hover:text-indigo-600 transition-colors p-1 inline-block"
            title="Edit job"
            aria-label="Edit job"
          >
            <Pencil size={14} />
          </Link>
          <Link
            href={`/repairs/${job.id}/print`}
            target="_blank"
            className="text-neutral-400 hover:text-indigo-600 transition-colors p-1 inline-block"
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
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
          </div>
        )}
      </td>
    </tr>
  );
}

export default function ArrivalListingClient({
  jobs,
  mechanics,
  branchSelection,
  allActiveJobs,
}: {
  jobs: RepairJob[];
  mechanics: Mechanic[];
  branchSelection: BranchSelection;
  allActiveJobs: RepairJob[];
}) {
  const showBranchColumn = branchSelection === "all";
  const quickAddBranch: Branch | null = branchSelection === "all" ? null : branchSelection;
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? jobs.filter((j) => j.plateNo.toLowerCase().includes(q) || (j.picName ?? "").toLowerCase().includes(q))
      : jobs;
    return [...filtered].sort((a, b) => {
      const dateOf = (j: RepairJob) => j.arrivedDate || j.createdAt || "";
      return sortDir === "desc" ? dateOf(b).localeCompare(dateOf(a)) : dateOf(a).localeCompare(dateOf(b));
    });
  }, [jobs, query, sortDir]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or plate no…"
              className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 w-64"
            />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:border-indigo-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            title="Sort by arrived date"
          >
            <ArrowUpDown size={14} /> {sortDir === "desc" ? "Newest" : "Oldest"}
          </button>
        </div>
        {quickAddBranch ? (
          <AddBikeButton branch={quickAddBranch} />
        ) : (
          <Link
            href="/repairs/new"
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Bike
          </Link>
        )}
      </div>
      <p className="text-xs text-neutral-500 mb-3">Bikes that have arrived but haven&apos;t been assigned to a mechanic yet.</p>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th className="font-medium px-5 py-3 whitespace-nowrap">No.</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Arrived</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Thumbprint</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Plate</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Model</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Tahun</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mileage</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Condition</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Cost Restore</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Assign</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((job, i) => (
                <ArrivalRow key={job.id} no={i + 1} job={job} showBranch={showBranchColumn} mechanics={mechanics} allActiveJobs={allActiveJobs} />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    {jobs.length === 0 ? "No bikes waiting to be assigned." : "No bikes match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
