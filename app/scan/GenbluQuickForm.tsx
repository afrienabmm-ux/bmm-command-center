"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { addGenbluRegistrationAction } from "@/lib/genblu-actions";
import { BRANCHES, type Branch } from "@/lib/branch";
import type { Mechanic } from "@/lib/types";

// Same fields as the GenBlu Tracker's "New Registration" modal, just laid
// out as a plain card instead of a popup — this page has no other modals
// competing for space, and a phone screen is tight enough already.
export default function GenbluQuickForm({
  branch,
  locked,
  mechanics,
}: {
  branch: Branch;
  locked: boolean;
  mechanics: Mechanic[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [regBranch, setRegBranch] = useState<Branch>(branch);
  const branchMechanics = mechanics.filter((m) => m.branch === regBranch);
  const [salespersonId, setSalespersonId] = useState(branchMechanics[0]?.id ?? "custom");
  // Bumping this remounts the form (clearing every field, including the
  // uncontrolled file input) after a successful submit, so the next
  // registration starts clean without a page reload.
  const [formKey, setFormKey] = useState(0);

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
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await addGenbluRegistrationAction(formData);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-neutral-900">New GenBlu Registration</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">Upload the points screenshot straight from your phone's gallery.</p>
      <form key={formKey} action={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
          <select
            name="branch"
            defaultValue={regBranch}
            onChange={(e) => handleBranchChange(e.target.value as Branch)}
            disabled={locked}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
          >
            {BRANCHES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Salesperson Name *</label>
          {branchMechanics.length > 0 ? (
            <select
              value={salespersonId}
              onChange={(e) => setSalespersonId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              {branchMechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortName} ({m.shortCode})
                </option>
              ))}
              <option value="custom">Other (type manually)</option>
            </select>
          ) : (
            <input
              type="text"
              name="salesperson_name"
              required
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
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
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Code</label>
              <input
                type="text"
                name="salesperson_code"
                placeholder="e.g. NJ"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name</label>
          <input
            type="text"
            name="customer_name"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
          />
          <p className="text-xs text-neutral-500 mt-1.5">Used to match this customer's spending to GenBlu points.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Plate No. *</label>
          <input
            type="text"
            name="customer_plate_no"
            required
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Points Screenshot</label>
          <input
            type="file"
            name="screenshot"
            accept="image/*"
            className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        {done && !isPending && (
          <p className="text-sm text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 size={15} /> Registration saved.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {isPending ? "Saving…" : "Save Registration"}
        </button>
      </form>
    </div>
  );
}
