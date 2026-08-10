"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";
import { addMechanicAction, toggleMechanicStatusAction, deleteMechanicAction } from "@/lib/mechanics-actions";
import type { Mechanic, MechanicStatus } from "@/lib/types";
import { BRANCHES, branchLabel, type BranchSelection } from "@/lib/branch";

export default function MechanicsClient({
  mechanics,
  activeBranch,
}: {
  mechanics: Mechanic[];
  activeBranch: BranchSelection;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const showBranch = activeBranch === "all";

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Mechanic
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mechanics.map((m) => (
          <MechanicCard key={m.id} mechanic={m} showBranch={showBranch} />
        ))}
        {mechanics.length === 0 && (
          <p className="text-sm text-neutral-500 col-span-full text-center py-10">No mechanics added yet.</p>
        )}
      </div>

      {modalOpen && (
        <AddMechanicModal activeBranch={activeBranch} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function MechanicCard({ mechanic, showBranch }: { mechanic: Mechanic; showBranch: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isActive = mechanic.status === "Active";

  function toggle() {
    const next: MechanicStatus = isActive ? "On Leave" : "Active";
    startTransition(() => toggleMechanicStatusAction(mechanic.id, mechanic.branch, next));
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Wrench size={16} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {mechanic.shortName} <span className="text-neutral-500 font-normal">({mechanic.shortCode})</span>
            </p>
            <p className="text-xs text-neutral-500">{mechanic.fullName}</p>
            {showBranch && (
              <p className="text-xs text-indigo-600 font-medium mt-0.5">{branchLabel(mechanic.branch)}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-neutral-400 hover:text-red-700 transition-colors"
          aria-label="Remove mechanic"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <button
        onClick={toggle}
        disabled={isPending}
        className={`mt-4 w-full text-xs font-medium py-2 rounded-lg border transition-colors disabled:opacity-50 ${
          isActive
            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20"
            : "bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20"
        }`}
      >
        {isActive ? "● Active — click to set On Leave" : "● On Leave — click to set Active"}
      </button>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Remove mechanic?</h2>
            <p className="text-sm text-neutral-600 mb-6">
              This will remove <span className="text-neutral-800 font-medium">{mechanic.shortName}</span> from the
              team list.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => startTransition(() => deleteMechanicAction(mechanic.id, mechanic.branch))}
                disabled={isPending}
                className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddMechanicModal({
  activeBranch,
  onClose,
}: {
  activeBranch: BranchSelection;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [shortName, setShortName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [branch, setBranch] = useState(activeBranch === "all" ? BRANCHES[0].value : activeBranch);
  const [isPending, startTransition] = useTransition();

  const canSave = fullName.trim() !== "" && shortName.trim() !== "" && shortCode.trim() !== "";

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await addMechanicAction({
        branch,
        fullName: fullName.trim(),
        shortName: shortName.trim(),
        shortCode: shortCode.trim(),
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Add Mechanic</h2>
        <div className="space-y-4">
          {activeBranch === "all" && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch *</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as typeof branch)}
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Full Name *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Nur Ain Binti Ahmad"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Short Name *</label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="e.g. NAJUA"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Short Code *</label>
            <input
              type="text"
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder="e.g. NJ"
              maxLength={4}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 uppercase"
            />
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
            Add Mechanic
          </button>
        </div>
      </div>
    </div>
  );
}
