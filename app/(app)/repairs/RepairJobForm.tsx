"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, ChevronDown } from "lucide-react";
import {
  addRepairJobAction,
  updateRepairJobAction,
  uploadRestoreBikeImagesAction,
  removeRestoreBikeImageAction,
  getRestoreBikeImageUrl,
} from "@/lib/repairs-actions";
import { DEAL_TYPES, RESTORE_BIKE_CONDITIONS, type RestoreBikeCondition, type RepairJob } from "@/lib/types";
import type { Mechanic, Package, CatalogProduct } from "@/lib/types";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/lib/useToast";

type ItemInput = { code: string; description: string; quantity: string; price: string };

const MAX_PHOTOS = 5;

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

// Search text for a catalog suggestion combines the product name and spec
// (e.g. "Motul 5100 15W-50") — the same string that gets filled into the
// item's description when a mechanic picks one, and what typed text is
// matched against.
function catalogLabel(p: CatalogProduct): string {
  const nameWithSpec = p.spec ? `${p.productName} ${p.spec}` : p.productName;
  // Include the brand so searching "Yamalube" or "Rock Oil" surfaces every
  // product under it — most product names don't repeat their own brand.
  return `${p.brand} ${nameWithSpec}`;
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
  const [suggestionsFor, setSuggestionsFor] = useState<number | null>(null);

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
  function pickSuggestion(i: number, product: CatalogProduct) {
    update(i, { description: catalogLabel(product), price: String(product.price) });
    setSuggestionsFor(null);
  }
  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Parts / Items</label>
      {packages.length > 0 && (
        <div className="relative mb-2">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addPackage(e.target.value);
              e.target.value = "";
            }}
            className="w-full appearance-none bg-red-50 border border-red-200 hover:border-red-300 rounded-xl pl-3 pr-9 py-2 text-sm text-red-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
          >
            <option value="">+ Add from Services Combo (optional)…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(p.price)}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />
        </div>
      )}
      <div className="space-y-2">
        {items.map((it, i) => {
          const query = it.description.trim().toLowerCase();
          const suggestions =
            suggestionsFor === i && query
              ? catalogProducts
                  .filter((p) => catalogLabel(p).toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
                  .slice(0, 8)
              : [];
          return (
            <div
              key={i}
              className="grid grid-cols-1 sm:grid-cols-[auto_90px_1fr_70px_100px_auto] gap-2 sm:items-center border-b border-neutral-100 sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0"
            >
              <span className="text-xs text-neutral-400 w-5 text-right tabular-nums">{i + 1}.</span>
              <input
                type="text"
                value={it.code}
                onChange={(e) => update(i, { code: e.target.value })}
                placeholder="Code"
                className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
              <div className="relative">
                <input
                  type="text"
                  value={it.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  onFocus={() => setSuggestionsFor(i)}
                  onBlur={() => setTimeout(() => setSuggestionsFor((cur) => (cur === i ? null : cur)), 150)}
                  placeholder="e.g. Engine Oil — or search the catalog"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => pickSuggestion(i, p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center justify-between gap-2"
                      >
                        <span className="text-neutral-800">
                          {catalogLabel(p)}
                          {p.code && <span className="text-neutral-400"> ({p.code})</span>}
                        </span>
                        <span className="text-neutral-500 shrink-0">{formatCurrency(p.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="number"
                min={0}
                value={it.quantity}
                onChange={(e) => update(i, { quantity: e.target.value })}
                placeholder="Qty"
                className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
              <input
                type="number"
                min={0}
                value={it.price}
                onChange={(e) => update(i, { price: e.target.value })}
                placeholder="Price"
                className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
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
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
        >
          <Plus size={13} /> Add Item
        </button>
        <button
          type="button"
          onClick={addTwentyRows}
          className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
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
  // A bike physically arrives at one branch — no "All Branches" option
  // here (that's only meaningful once a mechanic is picked, and
  // assignment now happens from the Arrival Listing tab instead).
  const [locationBranch, setLocationBranch] = useState<Branch>(
    job?.branch ?? (branchSelection !== "all" ? branchSelection : BRANCHES[0].value)
  );
  const [revenueAmount, setRevenueAmount] = useState(job ? String(job.revenueAmount) : "");
  const [dealType, setDealType] = useState<(typeof DEAL_TYPES)[number]>(
    (job?.dealType as (typeof DEAL_TYPES)[number]) || "Trade In"
  );
  const [picName, setPicName] = useState(job?.picName ?? "");
  const [picSuggestionsOpen, setPicSuggestionsOpen] = useState(false);
  const [preparedBy, setPreparedBy] = useState(job?.preparedBy ?? "");
  const [model, setModel] = useState(job?.model ?? "");
  const [bikeYear, setBikeYear] = useState(job?.bikeYear ?? "");
  const [condition, setCondition] = useState<RestoreBikeCondition>(
    RESTORE_BIKE_CONDITIONS.includes(job?.condition as RestoreBikeCondition) ? (job!.condition as RestoreBikeCondition) : "L"
  );
  const [mileageKm, setMileageKm] = useState(job?.mileageKm ?? "");
  const [arrivedDate, setArrivedDate] = useState(job?.arrivedDate ?? "");
  const [isBigItem, setIsBigItem] = useState(job?.isBigItem ?? false);
  const [items, setItems] = useState<ItemInput[]>(job ? itemsFromJob(job) : []);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<{ path: string; url: string }[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showError, toastNode } = useToast();
  const formDateRef = useRef<HTMLInputElement>(null);
  const plateNoRef = useRef<HTMLInputElement>(null);
  const picNameRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const bikeYearRef = useRef<HTMLInputElement>(null);
  const arrivedDateRef = useRef<HTMLInputElement>(null);
  const mileageRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!job?.imagePaths || job.imagePaths.length === 0) return;
    Promise.all(job.imagePaths.map(async (path) => ({ path, url: await getRestoreBikeImageUrl(path) }))).then((results) => {
      setExistingPhotos(results.filter((r): r is { path: string; url: string } => r.url !== null));
    });
  }, [job?.imagePaths]);

  const branchMechanics = mechanics.filter((m) => m.branch === locationBranch);

  const itemsTotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  function handleLocationChange(next: Branch) {
    setLocationBranch(next);
  }

  const photoSlotsUsed = existingPhotos.length + newPhotoFiles.length;
  const photoSlotsLeft = MAX_PHOTOS - photoSlotsUsed;

  function handlePhotoSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, photoSlotsLeft);
    setNewPhotoFiles((prev) => [...prev, ...picked]);
    setImageError(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function removeNewPhoto(index: number) {
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingPhoto(path: string) {
    if (!job) return;
    startTransition(async () => {
      const result = await removeRestoreBikeImageAction(job.id, job.branch, path);
      if (result && "error" in result) {
        showError(result.error);
        return;
      }
      setExistingPhotos((prev) => prev.filter((p) => p.path !== path));
    });
  }

  // All 5 photo slots must be filled before saving.
  const hasAllPhotos = photoSlotsUsed >= MAX_PHOTOS;

  // Jumps to and highlights whichever required field is still empty,
  // instead of leaving the PIC staring at a disabled button with no idea
  // why it won't save.
  function scrollToField(el: HTMLElement | null) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  function handleSave() {
    if (formDate.trim() === "") {
      scrollToField(formDateRef.current);
      return;
    }
    if (plateNo.trim() === "") {
      scrollToField(plateNoRef.current);
      return;
    }
    if (picName.trim() === "") {
      scrollToField(picNameRef.current);
      return;
    }
    if (model.trim() === "") {
      scrollToField(modelRef.current);
      return;
    }
    if (bikeYear.trim() === "") {
      scrollToField(bikeYearRef.current);
      return;
    }
    if (arrivedDate.trim() === "") {
      scrollToField(arrivedDateRef.current);
      return;
    }
    if (!hasAllPhotos) {
      setImageError(`All ${MAX_PHOTOS} bike photos are required.`);
      scrollToField(imageRef.current);
      return;
    }
    // A "Tarik" (withdrawn) bike isn't actually being worked on, so there's
    // no odometer reading to record for it — every other deal type still
    // requires one.
    if (dealType !== "Tarik" && mileageKm.trim() === "") {
      scrollToField(mileageRef.current);
      return;
    }
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
      // Assignment now happens from the Arrival Listing tab — this form
      // never touches mechanic_id, so an already-assigned job keeps its
      // mechanic across edits.
      mechanicId: job?.mechanicId ?? null,
      description: "",
      revenueAmount: Number(revenueAmount) || 0,
      dealType,
      formDate,
      picName: picName.trim(),
      preparedBy: preparedBy.trim(),
      model: model.trim(),
      bikeYear: bikeYear.trim(),
      condition: condition.trim(),
      mileageKm: mileageKm.trim(),
      arrivedDate: arrivedDate || null,
      location: branchLabel(locationBranch),
      items: cleanItems,
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
          showError(result.error);
          return;
        }
      } else {
        const result = await addRepairJobAction({ ...payload, branch: locationBranch, jobType: "Restore Bike" });
        if ("error" in result) {
          showError(result.error);
          return;
        }
        jobId = result.id;
      }
      if (newPhotoFiles.length > 0 && jobId) {
        const imageFormData = new FormData();
        newPhotoFiles.forEach((file) => imageFormData.append("images", file));
        const uploadResult = await uploadRestoreBikeImagesAction(jobId, locationBranch, imageFormData);
        if (uploadResult && "error" in uploadResult) {
          // Stay on the page (instead of navigating away like the success
          // path below) so the PIC actually sees this — the job itself did
          // save, just not the photos.
          showError(`Job saved, but the photo upload failed: ${uploadResult.error}`);
          return;
        }
      }
      router.push("/repairs");
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      {toastNode}
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Date Filled *</label>
            <input
              ref={formDateRef}
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
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
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Thumbprint *</label>
            <input
              ref={picNameRef}
              type="text"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              onFocus={() => setPicSuggestionsOpen(true)}
              onBlur={() => setTimeout(() => setPicSuggestionsOpen(false), 150)}
              placeholder="Type a name…"
              autoComplete="off"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
            {picSuggestionsOpen &&
              (() => {
                const matches = branchMechanics.filter((m) =>
                  m.shortName.toLowerCase().includes(picName.trim().toLowerCase())
                );
                if (matches.length === 0) return null;
                return (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setPicName(m.shortName);
                          setPicSuggestionsOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-sm text-neutral-800 hover:bg-neutral-50 transition-colors"
                      >
                        {m.shortName}
                      </button>
                    ))}
                  </div>
                );
              })()}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Prepare By</label>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Name of whoever prepared this quotation"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Model *</label>
              <input
                ref={modelRef}
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Y15ZR"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Tahun *</label>
              <input
                ref={bikeYearRef}
                type="text"
                value={bikeYear}
                onChange={(e) => setBikeYear(e.target.value)}
                placeholder="e.g. 2019"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Condition *</label>
            <div className="relative">
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as RestoreBikeCondition)}
                className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
              >
                {RESTORE_BIKE_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c} — {c === "L" ? "Light" : "Heavy"}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Arrived Date *</label>
            <input
              ref={arrivedDateRef}
              type="date"
              value={arrivedDate}
              onChange={(e) => setArrivedDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div ref={imageRef} tabIndex={-1}>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Bike Photos ({MAX_PHOTOS} required)</label>
            {(existingPhotos.length > 0 || newPhotoFiles.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-2">
                {existingPhotos.map((p) => (
                  <div key={p.path} className="relative">
                    <img src={p.url} alt="Bike" className="w-24 h-24 object-cover rounded-lg border border-neutral-200" />
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(p.path)}
                      disabled={isPending}
                      className="absolute -top-1.5 -right-1.5 bg-white border border-neutral-300 rounded-full p-0.5 text-neutral-500 hover:text-red-600 disabled:opacity-50"
                      aria-label="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {newPhotoFiles.map((file, i) => (
                  <div key={i} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="New bike photo"
                      className="w-24 h-24 object-cover rounded-lg border border-red-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewPhoto(i)}
                      className="absolute -top-1.5 -right-1.5 bg-white border border-neutral-300 rounded-full p-0.5 text-neutral-500 hover:text-red-600"
                      aria-label="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photoSlotsLeft > 0 && (
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handlePhotoSelect(e.target.files)}
                className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
              />
            )}
            {imageError && <p className="text-xs text-red-600 mt-1.5">{imageError}</p>}
            <p className="text-xs text-neutral-500 mt-1.5">
              All {MAX_PHOTOS} photos are required — {photoSlotsUsed} of {MAX_PHOTOS} uploaded.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Mileage (KM){dealType !== "Tarik" && " *"}
            </label>
            <input
              ref={mileageRef}
              type="text"
              value={mileageKm}
              onChange={(e) => setMileageKm(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Location *</label>
            <div className="relative">
              <select
                value={locationBranch}
                disabled={locked}
                onChange={(e) => handleLocationChange(e.target.value as Branch)}
                className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer disabled:opacity-60"
              >
                {BRANCHES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is-big-item"
              type="checkbox"
              checked={isBigItem}
              onChange={(e) => setIsBigItem(e.target.checked)}
              className="accent-red-500"
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
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-60"
            />
            <p className="text-xs text-neutral-500 mt-1.5">Calculated automatically from the parts/items list above.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Trade In / Tarik / Jual *</label>
            <div className="flex items-center gap-2">
              {DEAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDealType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    dealType === t
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-red-500/50"
                  }`}
                >
                  {t}
                </button>
              ))}
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
            className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Job"}
          </button>
        </div>
      </div>
    </div>
  );
}
