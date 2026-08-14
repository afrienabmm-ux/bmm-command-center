"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { addRepairJobAction, updateRepairJobAction } from "@/lib/repairs-actions";
import { DEAL_TYPES, HEAVY_ITEM_COUNT_THRESHOLD, type RepairJob } from "@/lib/types";
import type { Mechanic } from "@/lib/types";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency } from "@/lib/format";

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
  function addTwentyRows() {
    onChange([...items, ...Array.from({ length: 20 }, emptyItem)]);
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
          <div key={i} className="grid grid-cols-[auto_1fr_70px_100px_auto] gap-2 items-center">
            <span className="text-xs text-neutral-400 w-5 text-right tabular-nums">{i + 1}.</span>
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
      <div className="flex items-center gap-4 mt-2">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <Plus size={13} /> Add Item
        </button>
        <button
          type="button"
          onClick={addTwentyRows}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <Plus size={13} /> Add 20 Items
        </button>
      </div>
      {items.length > 0 && (
        <p className="text-xs text-neutral-500 mt-2">
          Total from items: <span className="font-semibold text-neutral-800">{formatCurrency(total)}</span>
        </p>
      )}
    </div>
  );
}

export default function RepairJobForm({
  job,
  branchSelection,
  locked,
  mechanics,
  allActiveJobs,
}: {
  job: RepairJob | null;
  branchSelection: BranchSelection;
  locked: boolean;
  mechanics: Mechanic[];
  allActiveJobs: RepairJob[];
}) {
  const router = useRouter();
  const isEdit = job !== null;
  // Set the instant the form opens (or the job's own date when editing) —
  // the PIC shouldn't have to remember to fill this in themselves.
  const [startedDate, setStartedDate] = useState(job?.startedDate ?? new Date().toISOString().slice(0, 10));
  const [plateNo, setPlateNo] = useState(job?.plateNo ?? "");
  const [locationBranch, setLocationBranch] = useState<BranchSelection>(job?.branch ?? branchSelection);
  const [mechanicId, setMechanicId] = useState(job?.mechanicId ?? "");
  const [revenueAmount, setRevenueAmount] = useState(job ? String(job.revenueAmount) : "");
  const [dealType, setDealType] = useState<(typeof DEAL_TYPES)[number]>(
    (job?.dealType as (typeof DEAL_TYPES)[number]) || "Trade In"
  );
  const [picName, setPicName] = useState(job?.picName ?? "");
  const [model, setModel] = useState(job?.model ?? "");
  const [bikeYear, setBikeYear] = useState(job?.bikeYear ?? "");
  const [condition, setCondition] = useState(job?.condition ?? "");
  const [mileageKm, setMileageKm] = useState(job?.mileageKm ?? "");
  const [stockOrderDate, setStockOrderDate] = useState(job?.stockOrderDate ?? "");
  const [stockArriveDate, setStockArriveDate] = useState(job?.stockArriveDate ?? "");
  const [completedDate, setCompletedDate] = useState(job?.completedDate ?? "");
  const [isBigItem, setIsBigItem] = useState(job?.isBigItem ?? false);
  const [items, setItems] = useState<ItemInput[]>(job ? itemsFromJob(job) : []);
  const [isPending, startTransition] = useTransition();

  const itemCount = items.filter((it) => it.description.trim() !== "").length;
  const isHeavyJob = itemCount > HEAVY_ITEM_COUNT_THRESHOLD || isBigItem;

  // A mechanic already carrying another active (non-Completed) job can't be
  // handed a second one until it's marked Completed.
  const busyMechanicIds = useMemo(
    () => new Set(allActiveJobs.filter((j) => j.id !== job?.id && j.mechanicId).map((j) => j.mechanicId as string)),
    [allActiveJobs, job]
  );

  const branchMechanics = locationBranch === "all" ? mechanics : mechanics.filter((m) => m.branch === locationBranch);
  const eligibleMechanics = branchMechanics.filter((m) => {
    if (m.id === mechanicId) return true;
    if (busyMechanicIds.has(m.id)) return false;
    if (isHeavyJob && m.category !== "Heavy Repair") return false;
    return true;
  });
  const selectedMechanic = branchMechanics.find((m) => m.id === mechanicId) ?? null;
  const effectiveBranch: Branch | null = locationBranch !== "all" ? locationBranch : (selectedMechanic?.branch ?? null);

  const itemsTotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  // If the job becomes heavy (more items added, or the checkbox is ticked)
  // and the currently picked mechanic isn't a Heavy Repair mechanic, clear
  // the pick instead of silently letting an invalid combination be saved.
  useEffect(() => {
    if (isHeavyJob && selectedMechanic && selectedMechanic.category !== "Heavy Repair") {
      setMechanicId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHeavyJob]);

  function handleLocationChange(next: BranchSelection) {
    setLocationBranch(next);
    setMechanicId("");
  }

  // Every job needs a mechanic assigned before it can be saved.
  const canSave = plateNo.trim() !== "" && effectiveBranch !== null && mechanicId !== "";

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
      customerName: "",
      plateNo: plateNo.trim(),
      mechanicId: mechanicId || null,
      description: "",
      revenueAmount: Number(revenueAmount) || 0,
      dealType,
      startedDate,
      picName: picName.trim(),
      model: model.trim(),
      bikeYear: bikeYear.trim(),
      condition: condition.trim(),
      mileageKm: mileageKm.trim(),
      location: branchLabel(effectiveBranch),
      items: cleanItems,
      stockOrderDate: stockOrderDate || null,
      stockArriveDate: stockArriveDate || null,
      completedDate: completedDate || null,
      isBigItem,
    };

    startTransition(async () => {
      if (isEdit && job) {
        await updateRepairJobAction(job.id, job.branch, payload);
      } else {
        await addRepairJobAction({ ...payload, branch: effectiveBranch, jobType: "Restore Bike" });
      }
      router.push("/repairs");
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Started Date</label>
            <input
              type="date"
              value={startedDate}
              onChange={(e) => setStartedDate(e.target.value)}
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mileage (KM)</label>
            <input
              type="text"
              value={mileageKm}
              onChange={(e) => setMileageKm(e.target.value)}
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mechanic *</label>
            <select
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="" disabled>
                Select a mechanic…
              </option>
              {eligibleMechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortName} ({m.shortCode})
                  {locationBranch === "all" ? ` — ${branchLabel(m.branch)}` : ""}
                  {m.category === "Heavy Repair" ? " — Heavy Repair" : ""}
                </option>
              ))}
            </select>
            {isHeavyJob && (
              <p className="text-xs text-amber-700 mt-1.5">
                Heavy job (more than {HEAVY_ITEM_COUNT_THRESHOLD} items{isBigItem ? " / marked as a big item" : ""}) — only Heavy Repair mechanics can be assigned.
              </p>
            )}
            {branchMechanics.length > eligibleMechanics.length && (
              <p className="text-xs text-neutral-500 mt-1.5">
                {branchMechanics.length - eligibleMechanics.length} mechanic{branchMechanics.length - eligibleMechanics.length === 1 ? "" : "s"} hidden — already on an active job, or not a Heavy Repair mechanic.
              </p>
            )}
            {mechanicId === "" && (
              <p className="text-xs text-neutral-500 mt-1.5">A mechanic must be assigned before this job can be saved.</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is-big-item"
              type="checkbox"
              checked={isBigItem}
              onChange={(e) => setIsBigItem(e.target.checked)}
              className="accent-indigo-500"
            />
            <label htmlFor="is-big-item" className="text-xs font-medium text-neutral-600">
              Big / heavy item repair — even with {HEAVY_ITEM_COUNT_THRESHOLD} items or fewer
            </label>
          </div>

          <ItemsEditor items={items} onChange={setItems} />

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Cost Restore (RM)</label>
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">End Date</label>
            <input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            <p className="text-xs text-neutral-500 mt-1.5">
              Leave the end date blank to fill it in automatically when the job is marked Completed.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Trade In / Tarik</label>
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
        </div>
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-200">
          <button
            onClick={() => router.push("/repairs")}
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
