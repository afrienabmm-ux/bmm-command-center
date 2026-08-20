"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { addRepairJobAction, updateRepairJobAction, uploadRestoreBikeImageAction, getRestoreBikeImageUrl } from "@/lib/repairs-actions";
import { DEAL_TYPES, RESTORE_BIKE_CONDITIONS, type RestoreBikeCondition, type RepairJob } from "@/lib/types";
import type { Mechanic, Package, CatalogProduct } from "@/lib/types";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency } from "@/lib/format";
import CatalogItemPicker from "@/components/CatalogItemPicker";

type ItemInput = { code: string; description: string; quantity: string; price: string };

const PIC_BY_BRANCH: Record<Branch, string> = { kapar: "TAUFIQ", puncak_alam: "SK", setia_alam: "PENG" };
const PIC_NAMES = Object.values(PIC_BY_BRANCH);

function emptyItem(): ItemInput {
  return { code: "", description: "", quantity: "1", price: "" };
}

function itemsFromJob(job: RepairJob): ItemInput[] {
  return job.items.map((i) => ({
    code: i.code,
    description: i.description,
    quantity: String(i.quantity),
    price: String(i.price),
  }));
}

function ItemsEditor({
  items,
  onChange,
  packages,
  catalogProducts,
}: {
  items: ItemInput[];
  onChange: (items: ItemInput[]) => void;
  packages: Package[];
  catalogProducts: CatalogProduct[];
}) {
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
  function addPackage(pkgId: string) {
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    onChange([...items, { code: "", description: pkg.name, quantity: "1", price: String(pkg.price) }]);
  }
  function addCatalogProduct(product: CatalogProduct) {
    onChange([...items, { code: product.code, description: product.productName, quantity: "1", price: String(product.price) }]);
  }
  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Parts / Items</label>
      {catalogProducts.length > 0 && <CatalogItemPicker products={catalogProducts} onSelect={addCatalogProduct} />}
      {packages.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) addPackage(e.target.value);
            e.target.value = "";
          }}
          className="w-full bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-800 focus:outline-none focus:border-indigo-500/50 mb-2"
        >
          <option value="">+ Add from Services Combo (optional)…</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatCurrency(p.price)}
            </option>
          ))}
        </select>
      )}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[auto_90px_1fr_70px_100px_auto] gap-2 items-center">
            <span className="text-xs text-neutral-400 w-5 text-right tabular-nums">{i + 1}.</span>
            <input
              type="text"
              value={it.code}
              onChange={(e) => update(i, { code: e.target.value })}
              placeholder="Code"
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
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
  packages,
  catalogProducts,
}: {
  job: RepairJob | null;
  branchSelection: BranchSelection;
  locked: boolean;
  mechanics: Mechanic[];
  allActiveJobs: RepairJob[];
  packages: Package[];
  catalogProducts: CatalogProduct[];
}) {
  const router = useRouter();
  const isEdit = job !== null;
  // The date this form was filled in — independent of the actual Repair
  // Start date, which is only set later by clicking "Start" on the list
  // (gated on GM approval).
  const [formDate, setFormDate] = useState(job?.formDate ?? new Date().toISOString().slice(0, 10));
  const [plateNo, setPlateNo] = useState(job?.plateNo ?? "");
  const [locationBranch, setLocationBranch] = useState<BranchSelection>(job?.branch ?? branchSelection);
  const [mechanicId, setMechanicId] = useState(job?.mechanicId ?? "");
  const [revenueAmount, setRevenueAmount] = useState(job ? String(job.revenueAmount) : "");
  const [dealType, setDealType] = useState<(typeof DEAL_TYPES)[number]>(
    (job?.dealType as (typeof DEAL_TYPES)[number]) || "Trade In"
  );
  const [picName, setPicName] = useState(
    job?.picName ?? (locationBranch !== "all" ? PIC_BY_BRANCH[locationBranch] : "")
  );
  const [model, setModel] = useState(job?.model ?? "");
  const [bikeYear, setBikeYear] = useState(job?.bikeYear ?? "");
  const [condition, setCondition] = useState<RestoreBikeCondition>(
    RESTORE_BIKE_CONDITIONS.includes(job?.condition as RestoreBikeCondition) ? (job!.condition as RestoreBikeCondition) : "L"
  );
  const [mileageKm, setMileageKm] = useState(job?.mileageKm ?? "");
  const [arrivedDate, setArrivedDate] = useState(job?.arrivedDate ?? "");
  const [stockOrderDate, setStockOrderDate] = useState(job?.stockOrderDate ?? "");
  const [stockArriveDate, setStockArriveDate] = useState(job?.stockArriveDate ?? "");
  const [isBigItem, setIsBigItem] = useState(job?.isBigItem ?? false);
  const [items, setItems] = useState<ItemInput[]>(job ? itemsFromJob(job) : []);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const plateNoRef = useRef<HTMLInputElement>(null);
  const mechanicRef = useRef<HTMLSelectElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job?.imagePath) return;
    getRestoreBikeImageUrl(job.imagePath).then(setExistingImageUrl);
  }, [job?.imagePath]);

  const isHeavyJob = isBigItem;

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
    if (next !== "all") setPicName(PIC_BY_BRANCH[next]);
  }

  // Every job needs a mechanic assigned before it can be saved. A photo of
  // the bike is required too — either a new upload, or (when editing) one
  // already on file.
  const hasImage = imageFile !== null || existingImageUrl !== null;

  // Jumps to and highlights whichever required field is still empty,
  // instead of leaving the PIC staring at a disabled button with no idea
  // why it won't save.
  function scrollToField(el: HTMLElement | null) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  function handleSave() {
    if (plateNo.trim() === "") {
      scrollToField(plateNoRef.current);
      return;
    }
    if (!hasImage) {
      setImageError("A photo of the bike is required.");
      scrollToField(imageRef.current);
      return;
    }
    if (!effectiveBranch) return;
    setImageError(null);
    const cleanItems = items
      .filter((it) => it.description.trim() !== "")
      .map((it) => ({
        code: it.code.trim(),
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
      }));

    const payload = {
      jobType: "Restore Bike" as const,
      customerName: "",
      plateNo: plateNo.trim(),
      mechanicId: mechanicId || null,
      description: "",
      revenueAmount: Number(revenueAmount) || 0,
      dealType,
      formDate,
      picName: picName.trim(),
      model: model.trim(),
      bikeYear: bikeYear.trim(),
      condition: condition.trim(),
      mileageKm: mileageKm.trim(),
      arrivedDate: arrivedDate || null,
      location: branchLabel(effectiveBranch),
      items: cleanItems,
      stockOrderDate: stockOrderDate || null,
      stockArriveDate: stockArriveDate || null,
      isBigItem,
      // Filling in and saving this form IS the quotation — no separate
      // click needed. Preserve an already-set date rather than restamping
      // it every time the job is edited again.
      quotationDate: job?.quotationDate ?? new Date().toISOString().slice(0, 10),
    };

    startTransition(async () => {
      let jobId = job?.id;
      if (isEdit && job) {
        const result = await updateRepairJobAction(job.id, job.branch, payload);
        if (result && "error" in result) {
          window.alert(result.error);
          return;
        }
      } else {
        const result = await addRepairJobAction({ ...payload, branch: effectiveBranch, jobType: "Restore Bike" });
        if ("error" in result) {
          window.alert(result.error);
          return;
        }
        jobId = result.id;
      }
      if (imageFile && jobId) {
        const imageFormData = new FormData();
        imageFormData.append("image", imageFile);
        await uploadRestoreBikeImageAction(jobId, effectiveBranch, imageFormData);
      }
      router.push("/repairs");
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Date Filled</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            <p className="text-xs text-neutral-500 mt-1.5">
              When this form was filled in — the actual repair start date is set later by clicking &quot;Start&quot; on the list.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Plate No. *</label>
            <input
              ref={plateNoRef}
              type="text"
              value={plateNo}
              onChange={(e) => setPlateNo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">PIC</label>
            <select
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="" disabled>
                Select PIC…
              </option>
              {picName && !PIC_NAMES.includes(picName) && <option value={picName}>{picName}</option>}
              {PIC_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
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
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as RestoreBikeCondition)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              {RESTORE_BIKE_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c} — {c === "L" ? "Light" : "Heavy"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Arrived Date</label>
            <input
              type="date"
              value={arrivedDate}
              onChange={(e) => setArrivedDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div ref={imageRef} tabIndex={-1}>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Bike Photo *</label>
            {existingImageUrl && !imageFile && (
              <img src={existingImageUrl} alt="Bike" className="w-32 h-32 object-cover rounded-lg border border-neutral-200 mb-2" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setImageFile(file);
                if (file) setImageError(null);
              }}
              className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
            />
            {imageError && <p className="text-xs text-red-600 mt-1.5">{imageError}</p>}
            <p className="text-xs text-neutral-500 mt-1.5">A photo of the bike is required before this job can be saved.</p>
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mechanic</label>
            <select
              ref={mechanicRef}
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="">Not assigned yet</option>
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
                Marked as a heavy / big item repair — only Heavy Repair mechanics can be assigned.
              </p>
            )}
            {branchMechanics.length > eligibleMechanics.length && (
              <p className="text-xs text-neutral-500 mt-1.5">
                {branchMechanics.length - eligibleMechanics.length} mechanic{branchMechanics.length - eligibleMechanics.length === 1 ? "" : "s"} hidden — already on an active job, or not a Heavy Repair mechanic.
              </p>
            )}
            {mechanicId === "" && (
              <p className="text-xs text-neutral-500 mt-1.5">
                Fine to leave unassigned — assign a mechanic later from the Restore Bike list.
              </p>
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
              Big / heavy item repair — only Heavy Repair mechanics can be assigned
            </label>
          </div>

          <ItemsEditor items={items} onChange={setItems} packages={packages} catalogProducts={catalogProducts} />

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Cost Restore (RM)</label>
            <input
              type="number"
              min={0}
              value={itemsTotal.toFixed(2)}
              disabled
              readOnly
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
            />
            <p className="text-xs text-neutral-500 mt-1.5">Calculated automatically from the parts/items list above.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Trade In / Tarik</label>
            <div className="flex items-center gap-2">
              {DEAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDealType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    dealType === t
                      ? "bg-indigo-500 border-indigo-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-indigo-500/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Stock Order Date</label>
              <input
                type="date"
                value={stockOrderDate}
                onChange={(e) => setStockOrderDate(e.target.value)}
                className="w-40 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Stock Arrive Date</label>
              <input
                type="date"
                value={stockArriveDate}
                onChange={(e) => setStockArriveDate(e.target.value)}
                className="w-40 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
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
            disabled={isPending}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Job"}
          </button>
        </div>
      </div>
    </div>
  );
}
