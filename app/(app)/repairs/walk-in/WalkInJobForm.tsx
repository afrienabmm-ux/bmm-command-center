"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ScanLine,
  Upload,
  CheckCircle2,
  AlertTriangle,
  User,
  Bike,
  ClipboardList,
  Wrench,
  Boxes,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { addRepairJobAction, updateRepairJobAction } from "@/lib/repairs-actions";
import { checkGenbluRegisteredAction, ensureGenbluRegistrationAction } from "@/lib/genblu-actions";
import { addPackageSaleAction } from "@/lib/packages-actions";
import type { ScannedJobsheet } from "@/lib/jobsheet-actions";
import type { RepairJob } from "@/lib/types";
import type { Mechanic, CatalogProduct, Package } from "@/lib/types";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/lib/useToast";

type ItemInput = { code: string; description: string; quantity: string; price: string };

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

// Visual-only grouping used on the phone scan page (variant="scan") — the
// desktop form stays one flat list, but a long wall of fields on a phone
// with no landmarks to scroll past feels a lot more tedious than the same
// fields broken into named steps.
function SectionHeader({ icon: Icon, title }: { icon: typeof User; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-red-600" />
      </div>
      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">{title}</p>
    </div>
  );
}

// Search text for a catalog suggestion combines the product name and spec
// (e.g. "Motul 5100 15W-50") — the same string that gets filled into the
// item's description when a mechanic picks one, and what typed text is
// matched against.
function catalogLabel(p: CatalogProduct): string {
  const nameWithSpec = p.spec ? `${p.productName} ${p.spec}` : p.productName;
  // Include the brand so searching "Yamalube" or "Rock Oil" surfaces every
  // product under it — most product names don't repeat their own brand,
  // but some catalog rows (e.g. "YAMALUBE 4T 10W-40") already have it
  // baked in, so skip prepending a second copy in that case.
  if (nameWithSpec.toLowerCase().startsWith(p.brand.toLowerCase())) return nameWithSpec;
  return `${p.brand} ${nameWithSpec}`;
}

function ItemsEditor({
  items,
  onChange,
  catalogProducts,
}: {
  items: ItemInput[];
  onChange: (items: ItemInput[]) => void;
  catalogProducts: CatalogProduct[];
}) {
  const [suggestionsFor, setSuggestionsFor] = useState<{ row: number; field: "code" | "description" } | null>(null);

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
  // Picking from the Code field's own dropdown fills the code too, since
  // that's the field being searched — picking from Description still
  // leaves code alone, as before.
  function pickSuggestion(i: number, product: CatalogProduct, field: "code" | "description") {
    update(i, {
      ...(field === "code" ? { code: product.code } : {}),
      description: catalogLabel(product),
      price: String(product.price),
    });
    setSuggestionsFor(null);
  }
  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Parts / Items</label>
      <p className="text-xs text-neutral-500 mb-2">
        Can&apos;t scan the item off the jobsheet? Type a few letters in the description field to search the parts
        catalog and pick it from the list instead.
      </p>
      <div className="space-y-2">
        {items.map((it, i) => {
          const activeField = suggestionsFor?.row === i ? suggestionsFor.field : null;
          const query = (activeField === "code" ? it.code : activeField === "description" ? it.description : "")
            .trim()
            .toLowerCase();
          const suggestions = activeField && query
            ? catalogProducts
                .filter((p) => catalogLabel(p).toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
                .slice(0, 8)
            : [];
          return (
            <div
              key={i}
              className="grid grid-cols-1 sm:grid-cols-[auto_150px_1fr_55px_80px_auto] gap-2 sm:items-center border-b border-neutral-100 sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0"
            >
              <span className="text-xs text-neutral-400 w-5 text-right tabular-nums">{i + 1}.</span>
              <div className="relative">
                <input
                  type="text"
                  value={it.code}
                  onChange={(e) => update(i, { code: e.target.value })}
                  onFocus={() => setSuggestionsFor({ row: i, field: "code" })}
                  onBlur={() =>
                    setTimeout(() => setSuggestionsFor((cur) => (cur?.row === i && cur.field === "code" ? null : cur)), 150)
                  }
                  placeholder="Code — or search the catalog"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
                {activeField === "code" && suggestions.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => pickSuggestion(i, p, "code")}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center justify-between gap-2"
                        title={catalogLabel(p)}
                      >
                        <span className="text-neutral-800 font-medium">{p.code || "—"}</span>
                        <span className="text-neutral-500 shrink-0">{formatCurrency(p.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={it.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  onFocus={() => setSuggestionsFor({ row: i, field: "description" })}
                  onBlur={() =>
                    setTimeout(() => setSuggestionsFor((cur) => (cur?.row === i && cur.field === "description" ? null : cur)), 150)
                  }
                  placeholder="e.g. Engine Oil — or search the catalog"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
                {activeField === "description" && suggestions.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        // Mousedown, not click — fires before the input's onBlur
                        // closes the list, so the click actually lands.
                        onMouseDown={() => pickSuggestion(i, p, "description")}
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

export default function WalkInJobForm({
  job,
  branchSelection,
  locked,
  mechanics,
  allActiveJobs,
  catalogProducts,
  packages,
  redirectTo = "/repairs/walk-in",
  variant = "full",
}: {
  job: RepairJob | null;
  branchSelection: BranchSelection;
  locked: boolean;
  mechanics: Mechanic[];
  allActiveJobs: RepairJob[];
  catalogProducts: CatalogProduct[];
  packages: Package[];
  // Where Save/Cancel send the browser afterward — the dashboard's full
  // Jobsheet list by default, but the standalone /scan page points this
  // back at itself so saving a job never drags a phone visitor into the
  // desktop dashboard's sidebar layout.
  redirectTo?: string;
  // "scan" turns on the phone-friendly visual treatment (section headers,
  // warmer scan card, sticky save bar) used only on /scan — the desktop
  // Restore/Walk-in admin forms keep today's plain layout untouched.
  variant?: "full" | "scan";
}) {
  const isScan = variant === "scan";
  const router = useRouter();
  const isEdit = job !== null;
  // Set the instant the form opens (or the job's own date when editing) —
  // the PIC shouldn't have to remember to fill this in themselves.
  const [startedDate, setStartedDate] = useState(job?.startedDate ?? new Date().toISOString().slice(0, 10));
  const [customerCode, setCustomerCode] = useState(job?.customerCode ?? "");
  const [customerName, setCustomerName] = useState(job?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(job?.customerPhone ?? "");
  const [plateNo, setPlateNo] = useState(job?.plateNo ?? "");
  const [colour, setColour] = useState(job?.colour ?? "");
  const [engineNo, setEngineNo] = useState(job?.engineNo ?? "");
  const [chassisNo, setChassisNo] = useState(job?.chassisNo ?? "");
  const [jobsheetNo, setJobsheetNo] = useState(job?.jobsheetNo ?? "");
  const [salesNo, setSalesNo] = useState(job?.salesNo ?? "");
  const [salesDate, setSalesDate] = useState(job?.salesDate ?? "");
  const [warrantyCardNo, setWarrantyCardNo] = useState(job?.warrantyCardNo ?? "");
  const [mileageKm, setMileageKm] = useState(job?.mileageKm ?? "");
  const [nextMileageKm, setNextMileageKm] = useState(job?.nextMileageKm ?? "");
  const [serviceType, setServiceType] = useState(job?.serviceType ?? "");
  const [nextServiceDate, setNextServiceDate] = useState(job?.nextServiceDate ?? "");
  const [jobsheetUserId, setJobsheetUserId] = useState(job?.jobsheetUserId ?? "");
  const [locationBranch, setLocationBranch] = useState<BranchSelection>(job?.branch ?? branchSelection);
  const [mechanicId, setMechanicId] = useState(job?.mechanicId ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [revenueAmount, setRevenueAmount] = useState(job ? String(job.revenueAmount) : "");
  const [model, setModel] = useState(job?.model ?? "");
  const [completedDate, setCompletedDate] = useState(job?.completedDate ?? "");
  const [isBigItem, setIsBigItem] = useState(job?.isBigItem ?? false);
  const [items, setItems] = useState<ItemInput[]>(job ? itemsFromJob(job) : []);
  const [hasGenblu, setHasGenblu] = useState(false);
  const [genbluAlreadyRegistered, setGenbluAlreadyRegistered] = useState<boolean | null>(null);
  const [genbluCheckPending, setGenbluCheckPending] = useState(false);
  const [genbluScreenshot, setGenbluScreenshot] = useState<File | null>(null);
  const genbluFileInputRef = useRef<HTMLInputElement>(null);
  const [wantsCombo, setWantsCombo] = useState(false);
  const [comboPackageId, setComboPackageId] = useState(packages[0]?.id ?? "");
  // Optional — falls back to the jobsheet number when left blank, since a
  // combo sold alongside a jobsheet is usually on the same receipt anyway.
  // Only needed when the package was rung up on its own separate receipt.
  const [comboReceiptId, setComboReceiptId] = useState("");
  const [isPending, startTransition] = useTransition();
  const { showError, showInfo, toastNode } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanMissing, setScanMissing] = useState<string[] | null>(null);
  const [scanRawText, setScanRawText] = useState<string | null>(null);
  const [scanSignatureDebug, setScanSignatureDebug] = useState<string | null>(null);
  // Best-effort result from the last scan — null until a scan has run (or
  // when the "Signature" label couldn't be found at all). Existing jobs
  // start confirmed since there's nothing new to check unless re-scanned.
  const [signatureDetected, setSignatureDetected] = useState<boolean | null>(null);
  const [signatureConfirmed, setSignatureConfirmed] = useState(isEdit);
  const [jobsheetPhotoPath, setJobsheetPhotoPath] = useState<string | null>(job?.jobsheetPhotoPath ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customerNameRef = useRef<HTMLInputElement>(null);
  const plateNoRef = useRef<HTMLInputElement>(null);
  const mechanicRef = useRef<HTMLSelectElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  // Phone photos can easily be 8-15MB — shrink to a max dimension before
  // sending, which keeps text plenty legible for OCR while cutting the
  // upload down to a fraction of the size. PDFs pass through untouched.
  function downscaleImage(file: File, maxDimension = 2000): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process the image."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image."))),
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load the image."));
      };
      img.src = url;
    });
  }

  async function handleScanFile(file: File) {
    setIsScanning(true);
    setScanError(null);
    setScanNotice(null);
    setScanMissing(null);
    setScanSignatureDebug(null);
    try {
      const isPdf = file.type === "application/pdf";
      const uploadBlob = isPdf ? file : await downscaleImage(file);
      const formData = new FormData();
      formData.append("file", uploadBlob, isPdf ? file.name : "jobsheet.jpg");

      const res = await fetch("/api/scan-jobsheet", { method: "POST", body: formData });
      const result: { data: ScannedJobsheet; photoPath: string | null } | { error: string } = await res.json();
      if ("error" in result) {
        setScanError(result.error);
        return;
      }
      const scanned = result.data;
      setJobsheetPhotoPath(result.photoPath);
      setScanRawText(scanned.rawText);
      setScanSignatureDebug(scanned.signatureDebug);
      setSignatureDetected(scanned.signatureDetected);
      // Never auto-tick this from the detector's result, even when it says
      // "detected" — the ink-texture check has come back true on a blank
      // jobsheet before (dense printed text near the signature line reads
      // as pen strokes), so the PIC always has to look at the photo and
      // confirm it themselves. The detector's result is shown below only
      // as a hint, not a substitute for that check.
      setSignatureConfirmed(false);
      if (scanned.signatureDetected !== true) {
        showError(
          "No customer signature detected on this jobsheet. Please check that the customer has signed it, or take a clearer photo and scan again."
        );
      }
      const filled: string[] = [];
      if (scanned.customerCode) {
        setCustomerCode(scanned.customerCode);
        filled.push("customer code");
      }
      if (scanned.customerName) {
        setCustomerName(scanned.customerName);
        filled.push("customer name");
      }
      if (scanned.customerPhone) {
        setCustomerPhone(scanned.customerPhone);
        filled.push("phone number");
      }
      if (scanned.plateNo) {
        setPlateNo(scanned.plateNo);
        filled.push("plate no.");
      }
      if (scanned.model) {
        setModel(scanned.model);
        filled.push("model");
      }
      if (scanned.colour) {
        setColour(scanned.colour);
        filled.push("colour");
      }
      if (scanned.engineNo) {
        setEngineNo(scanned.engineNo);
        filled.push("engine no.");
      }
      if (scanned.chassisNo) {
        setChassisNo(scanned.chassisNo);
        filled.push("chassis no.");
      }
      if (scanned.jobsheetNo) {
        setJobsheetNo(scanned.jobsheetNo);
        filled.push("job no.");
      }
      if (scanned.salesNo) {
        setSalesNo(scanned.salesNo);
        filled.push("sales no.");
      }
      if (scanned.salesDate) {
        setSalesDate(scanned.salesDate);
        filled.push("sales date");
      }
      if (scanned.warrantyCardNo) {
        setWarrantyCardNo(scanned.warrantyCardNo);
        filled.push("warranty card no.");
      }
      if (scanned.mileageKm) {
        setMileageKm(scanned.mileageKm);
        filled.push("mileage");
      }
      if (scanned.nextMileageKm) {
        setNextMileageKm(scanned.nextMileageKm);
        filled.push("next mileage");
      }
      if (scanned.serviceType) {
        setServiceType(scanned.serviceType);
        filled.push("service type");
      }
      if (scanned.nextServiceDate) {
        setNextServiceDate(scanned.nextServiceDate);
        filled.push("next service date");
      }
      if (scanned.jobsheetUserId) {
        setJobsheetUserId(scanned.jobsheetUserId);
        filled.push("user id");
      }
      if (scanned.startedDate) {
        setStartedDate(scanned.startedDate);
        filled.push("started date");
      }
      // Prefer inferring the branch from the mechanic code match itself —
      // a short code is a far more reliable OCR read than the branch name
      // printed in the header (e.g. "KAPAR" misread as "KAPAIT"), and
      // every mechanic belongs to exactly one branch anyway. Falls back to
      // the header-detected branch only when no mechanic code matched.
      const mechanicCandidates = locked ? mechanics.filter((m) => m.branch === locationBranch) : mechanics;
      // Only the first word is compared (trailing punctuation like "T."
      // stripped too) — a real mechanic code is always one short word, and
      // the raw scan sometimes has extra merged text right after it
      // ("NJ OR ..."). Stripping all non-alphanumeric characters instead of
      // just taking the first word would glue that extra text onto the
      // code ("NJ OR" -> "njor"), which is exactly why this missed reads
      // that had genuinely read the code correctly.
      const normalizeCode = (s: string) => (s.match(/^[a-z0-9]+/i)?.[0] ?? "").toLowerCase();
      const scannedCodeNormalized = normalizeCode(scanned.mechanicCode ?? "");
      const matchedMechanic = scannedCodeNormalized
        ? mechanicCandidates.find((m) => normalizeCode(m.shortCode) === scannedCodeNormalized)
        : undefined;
      if (matchedMechanic) {
        if (!locked) setLocationBranch(matchedMechanic.branch);
        setMechanicId(matchedMechanic.id);
        filled.push("mechanic");
      } else if (scanned.branch && !locked) {
        setLocationBranch(scanned.branch);
      }
      if (scanned.items.length > 0) {
        setItems(
          scanned.items.map((it) => ({
            code: it.code,
            description: it.description,
            quantity: String(it.quantity),
            price: String(it.price),
          }))
        );
        filled.push(`${scanned.items.length} item${scanned.items.length === 1 ? "" : "s"}`);
      }
      setScanNotice(
        filled.length > 0
          ? `Filled in from the jobsheet: ${filled.join(", ")}. Please check everything before saving.`
          : "Couldn't confidently read the jobsheet fields — please fill them in by hand."
      );

      // The fields that matter most for identifying the job — if any of
      // these didn't come through, the photo probably wasn't clear enough
      // rather than the jobsheet genuinely being blank there.
      const missing: string[] = [];
      if (!scanned.customerName) missing.push("Customer Name");
      if (!scanned.plateNo) missing.push("Plate No.");
      if (!scanned.model) missing.push("Model");
      if (!scanned.jobsheetNo) missing.push("Job No.");
      if (scanned.items.length === 0) missing.push("Items");
      setScanMissing(missing.length > 0 ? missing : null);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Something went wrong scanning the jobsheet.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const isHeavyJob = isBigItem;

  const branchMechanics = locationBranch === "all" ? mechanics : mechanics.filter((m) => m.branch === locationBranch);
  // No longer excludes mechanics who already have another active job — a
  // PIC can assign anyone regardless of how busy they already are, same
  // as Restore Bike assignment from the Arrival Listing tab.
  const eligibleMechanics = branchMechanics.filter((m) => {
    if (m.id === mechanicId) return true;
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

  // Look up whether this customer already has a GenBlu registration as soon
  // as the PIC says "yes" — if they're already in the tracker, there's no
  // need to ask for another screenshot.
  useEffect(() => {
    if (!hasGenblu || !customerName.trim() || !effectiveBranch) {
      setGenbluAlreadyRegistered(null);
      return;
    }
    let cancelled = false;
    setGenbluCheckPending(true);
    const timer = setTimeout(async () => {
      const found = await checkGenbluRegisteredAction(effectiveBranch, customerName.trim());
      if (!cancelled) {
        setGenbluAlreadyRegistered(found);
        setGenbluCheckPending(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hasGenblu, customerName, effectiveBranch]);

  function handleLocationChange(next: BranchSelection) {
    setLocationBranch(next);
    setMechanicId("");
  }

  // Jumps to and highlights whichever required field is still empty,
  // instead of leaving the PIC staring at a disabled button with no idea
  // why it won't save.
  function scrollToField(el: HTMLElement | null) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  function handleSave() {
    if (customerName.trim() === "") {
      showError("Please enter the customer's name.");
      scrollToField(customerNameRef.current);
      return;
    }
    if (plateNo.trim() === "") {
      showError("Please enter the plate number.");
      scrollToField(plateNoRef.current);
      return;
    }
    if (mechanicId === "") {
      showError("Please assign a mechanic.");
      scrollToField(mechanicRef.current);
      return;
    }
    if (!signatureConfirmed) {
      showError("Please confirm the customer has signed the jobsheet before saving.");
      scrollToField(signatureRef.current);
      return;
    }
    if (!effectiveBranch) {
      showError("Please pick a branch, or assign a mechanic to set it automatically.");
      return;
    }
    if (hasGenblu && !genbluAlreadyRegistered && !genbluScreenshot) {
      showError("Upload the customer's GenBlu screenshot before saving, or switch \"Customer has GenBlu?\" to No.");
      return;
    }
    if (wantsCombo && !comboPackageId) {
      showError("Pick a package, or switch \"Services Combo sold?\" to No.");
      return;
    }
    const cleanItems = items
      .filter((it) => it.description.trim() !== "")
      .map((it) => ({
        code: it.code.trim(),
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
      }));

    // Only set when a scan actually ran this session — otherwise omitted
    // so editing a job without rescanning doesn't wipe out whatever status
    // was recorded the first time it was scanned.
    const signatureStatus: string | undefined = scanRawText
      ? signatureDetected === true
        ? "detected"
        : signatureDetected === false
          ? "not_detected"
          : "unchecked"
      : undefined;

    const payload = {
      jobType: "Walk-in" as const,
      ...(signatureStatus !== undefined ? { signatureStatus } : {}),
      customerCode: customerCode.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      plateNo: plateNo.trim(),
      mechanicId: mechanicId || null,
      description: description.trim(),
      revenueAmount: Number(revenueAmount) || 0,
      dealType: "",
      startedDate,
      model: model.trim(),
      colour: colour.trim(),
      engineNo: engineNo.trim(),
      chassisNo: chassisNo.trim(),
      jobsheetNo: jobsheetNo.trim(),
      salesNo: salesNo.trim(),
      salesDate: salesDate.trim(),
      warrantyCardNo: warrantyCardNo.trim(),
      mileageKm: mileageKm.trim(),
      nextMileageKm: nextMileageKm.trim(),
      serviceType: serviceType.trim(),
      nextServiceDate: nextServiceDate.trim(),
      jobsheetUserId: jobsheetUserId.trim(),
      location: branchLabel(effectiveBranch),
      items: cleanItems,
      completedDate: completedDate || null,
      isBigItem,
      jobsheetPhotoPath,
    };

    const finalRevenue = items.length > 0 ? itemsTotal : Number(revenueAmount) || 0;

    startTransition(async () => {
      // Verify (and register) GenBlu BEFORE saving the job — if the
      // uploaded screenshot doesn't match the customer's name, the job
      // shouldn't be added at all, so the PIC has to fix the picture (or
      // switch GenBlu to No) rather than end up with a saved job and a
      // silently-failed registration.
      if (hasGenblu && !genbluAlreadyRegistered) {
        try {
          let genbluResult = await ensureGenbluRegistrationAction({
            branch: effectiveBranch,
            customerName: customerName.trim(),
            customerPlateNo: plateNo.trim(),
            screenshot: genbluScreenshot,
          });
          if (genbluResult && "warning" in genbluResult) {
            if (!window.confirm(genbluResult.warning)) {
              showError("Job not saved — pick a different GenBlu screenshot, or confirm to upload it anyway.");
              return;
            }
            genbluResult = await ensureGenbluRegistrationAction({
              branch: effectiveBranch,
              customerName: customerName.trim(),
              customerPlateNo: plateNo.trim(),
              screenshot: genbluScreenshot,
              confirmDuplicate: true,
            });
          }
          if (genbluResult && "error" in genbluResult) {
            showError(`Job not saved — ${genbluResult.error}`);
            return;
          }
        } catch {
          showError(
            "Job not saved — couldn't verify the GenBlu screenshot (the check took too long). Please try again."
          );
          return;
        }
      }

      if (isEdit && job) {
        const result = await updateRepairJobAction(job.id, job.branch, payload);
        if (result && "error" in result) {
          showError(result.error);
          return;
        }
      } else {
        const result = await addRepairJobAction({ ...payload, branch: effectiveBranch, jobType: "Walk-in" });
        if ("error" in result) {
          showError(result.error);
          return;
        }
      }

      if (wantsCombo && comboPackageId) {
        try {
          await addPackageSaleAction({
            branch: effectiveBranch,
            packageId: comboPackageId,
            mechanicId: mechanicId || null,
            receiptId: comboReceiptId.trim() || jobsheetNo.trim() || null,
            saleDate: startedDate,
            customerName: customerName.trim(),
            customerPlateNo: plateNo.trim(),
          });
        } catch {
          // Non-fatal — the job is already saved either way.
        }
      }

      if (hasGenblu) {
        if (genbluAlreadyRegistered) {
          // Already in the tracker — just match them up, no screenshot needed.
          try {
            await ensureGenbluRegistrationAction({
              branch: effectiveBranch,
              customerName: customerName.trim(),
              customerPlateNo: plateNo.trim(),
              screenshot: null,
            });
          } catch {
            // Non-fatal — the job is already saved either way.
          }
        }
        showInfo(
          `${customerName.trim()} earned ${Math.round(finalRevenue).toLocaleString()} GenBlu points (${formatCurrency(finalRevenue)}) from this job.`
        );
        // Give the PIC a moment to actually read the toast above before the
        // page navigates away — window.alert used to block until dismissed,
        // this is the non-blocking equivalent of that pause.
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      // A real page load, not router.push — after two "new job" saves in a
      // row, jobId stays undefined both times, so this form's key={jobId ??
      // "new"} never changes and a soft client-side navigation would leave
      // the same component instance (and all its typed-in state) on screen,
      // looking exactly like nothing was saved. A hard reload guarantees a
      // genuinely fresh, blank form — same as browsing back to the page.
      window.location.href = `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}saved=1`;
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      {toastNode}
      {!isEdit && (
        <div
          className={
            isScan
              ? "bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-2xl p-5 mb-5 shadow-lg shadow-red-900/10"
              : "bg-red-50 border border-red-200 rounded-xl p-5 mb-4"
          }
        >
          <div className="flex items-start gap-3">
            <div
              className={
                isScan
                  ? "w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0"
                  : "w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0"
              }
            >
              <ScanLine size={isScan ? 20 : 17} className={isScan ? "text-white" : "text-red-600"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={isScan ? "text-sm font-semibold text-white" : "text-sm font-semibold text-neutral-900"}>
                Scan Jobsheet
              </p>
              <p className={isScan ? "text-xs text-white/80 mt-0.5 mb-3" : "text-xs text-neutral-500 mt-0.5 mb-3"}>
                Upload a clear JPG or PNG photo of the paper jobsheet — it'll fill in the boxes below for you to check before saving.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                // No "capture" attribute here on purpose — it used to force
                // mobile straight into the camera app with no way back to
                // pick an existing photo from the gallery, which admin
                // needed for jobsheets photographed earlier.
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleScanFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className={
                  isScan
                    ? "flex items-center gap-1.5 bg-white hover:bg-red-50 disabled:opacity-60 text-red-700 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
                    : "flex items-center gap-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                }
              >
                <Upload size={15} /> {isScanning ? "Reading jobsheet…" : "Upload Jobsheet"}
              </button>
              {scanError && (
                <p
                  className={
                    isScan
                      ? "text-xs text-white bg-black/20 rounded-lg px-3 py-2 mt-2"
                      : "text-xs text-red-700 mt-2"
                  }
                >
                  {scanError}
                </p>
              )}
              {scanNotice && (
                <p
                  className={
                    isScan
                      ? "text-xs text-white bg-black/20 rounded-lg px-3 py-2 mt-2"
                      : "text-xs text-emerald-700 mt-2"
                  }
                >
                  {scanNotice}
                </p>
              )}
              {scanMissing && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800 font-medium">
                    Couldn&apos;t read: {scanMissing.join(", ")}. For an accurate reading, retake the photo — flat
                    surface, good lighting, and the whole jobsheet in frame.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors mt-2"
                  >
                    <Upload size={13} /> Retake Photo
                  </button>
                </div>
              )}
              {scanRawText && (
                <details className="mt-2">
                  <summary className={isScan ? "text-xs text-white/90 cursor-pointer" : "text-xs text-red-700 cursor-pointer"}>
                    What Google read from the photo (for troubleshooting)
                  </summary>
                  {scanSignatureDebug && (
                    <p className="mt-2 text-[11px] text-neutral-500 font-mono">Signature check: {scanSignatureDebug}</p>
                  )}
                  <pre className="mt-2 bg-white border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{scanRawText}</pre>
                </details>
              )}
              {!isEdit && (
                <div
                  ref={signatureRef}
                  tabIndex={-1}
                  className={`mt-3 border rounded-lg p-3 ${
                    signatureDetected === false ? "bg-red-50 border-red-200" : "bg-white border-neutral-200"
                  }`}
                >
                  {signatureDetected === true && (
                    <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Looks like a customer signature is on the jobsheet — please check the photo and confirm below.
                    </p>
                  )}
                  {signatureDetected === false && (
                    <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                      <AlertTriangle size={14} /> No customer sign detected — please ask the customer to sign the jobsheet before saving.
                    </p>
                  )}
                  {signatureDetected === null && scanRawText && (
                    <p className="text-xs text-neutral-500">
                      Couldn&apos;t check the photo for a signature — please confirm it by hand.
                    </p>
                  )}
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={signatureConfirmed}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        // Ticking this box against the detector's own "no
                        // signature found" result is exactly the moment a
                        // blank jobsheet could slip through unnoticed — a
                        // warning here, not a block, since the PIC may well
                        // have checked the photo themselves and know better
                        // than the heuristic.
                        if (checked && signatureDetected === false) {
                          showError(
                            "No customer signature was detected on this jobsheet — please double-check the photo before confirming."
                          );
                        }
                        setSignatureConfirmed(checked);
                      }}
                      className="accent-red-500"
                    />
                    <span className="text-xs font-medium text-neutral-700">Customer has signed the jobsheet *</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className={isScan ? "bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm" : "bg-white border border-neutral-200 rounded-xl p-6"}>
        <div className="space-y-4">
          {isScan && <SectionHeader icon={User} title="Customer" />}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Job Date</label>
            <input
              type="date"
              value={startedDate}
              onChange={(e) => setStartedDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Code</label>
            <input
              type="text"
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name *</label>
            <input
              ref={customerNameRef}
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 012-3456789"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
            <p className="text-[11px] text-neutral-400 mt-1">Matches this visit to their services card, even if the name is spelled differently.</p>
          </div>
          {isScan && <SectionHeader icon={Bike} title="Vehicle" />}
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
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">User ID</label>
            <input
              type="text"
              value={jobsheetUserId}
              onChange={(e) => setJobsheetUserId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Y16ZR"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Colour</label>
            <input
              type="text"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Engine No.</label>
            <input
              type="text"
              value={engineNo}
              onChange={(e) => setEngineNo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Chassis No.</label>
            <input
              type="text"
              value={chassisNo}
              onChange={(e) => setChassisNo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          {isScan && <SectionHeader icon={ClipboardList} title="Service Details" />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Job No. (jobsheet)</label>
              <input
                type="text"
                value={jobsheetNo}
                onChange={(e) => setJobsheetNo(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Sales No.</label>
              <input
                type="text"
                value={salesNo}
                onChange={(e) => setSalesNo(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Sales Date</label>
              <input
                type="date"
                value={salesDate}
                onChange={(e) => setSalesDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Warranty Card No.</label>
              <input
                type="text"
                value={warrantyCardNo}
                onChange={(e) => setWarrantyCardNo(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mileage (KM)</label>
              <input
                type="text"
                value={mileageKm}
                onChange={(e) => setMileageKm(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Next Mileage (KM)</label>
              <input
                type="text"
                value={nextMileageKm}
                onChange={(e) => setNextMileageKm(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Service Type</label>
              <input
                type="text"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="e.g. NORMAL SERVICE"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Next Service Date</label>
              <input
                type="date"
                value={nextServiceDate}
                onChange={(e) => setNextServiceDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
          {isScan && <SectionHeader icon={Wrench} title="Assignment" />}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Location</label>
            <div className="flex items-center gap-2 flex-wrap">
              {BRANCHES.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  disabled={locked}
                  onClick={() => handleLocationChange(b.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    locationBranch === b.value
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-red-500/50"
                  }`}
                >
                  {b.label}
                </button>
              ))}
              {!locked && (
                <button
                  type="button"
                  onClick={() => handleLocationChange("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    locationBranch === "all"
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-red-500/50"
                  }`}
                >
                  All Branches
                </button>
              )}
            </div>
            {locationBranch === "all" && !selectedMechanic && (
              <p className="text-xs text-amber-700 mt-1.5">Pick a mechanic below to set which branch this job belongs to.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Mechanic *</label>
            <div className="relative">
              <select
                ref={mechanicRef}
                value={mechanicId}
                onChange={(e) => setMechanicId(e.target.value)}
                className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
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
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
            {isHeavyJob && (
              <p className="text-xs text-amber-700 mt-1.5">
                Marked as a heavy / big item repair — only Heavy Repair mechanics can be assigned.
              </p>
            )}
            {branchMechanics.length > eligibleMechanics.length && (
              <p className="text-xs text-neutral-500 mt-1.5">
                {branchMechanics.length - eligibleMechanics.length} mechanic{branchMechanics.length - eligibleMechanics.length === 1 ? "" : "s"} hidden — not a Heavy Repair mechanic.
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
              className="accent-red-500"
            />
            <label htmlFor="is-big-item" className="text-xs font-medium text-neutral-600">
              Big / heavy item repair — only Heavy Repair mechanics can be assigned
            </label>
          </div>

          {isScan && <SectionHeader icon={Boxes} title="Parts & Cost" />}
          <ItemsEditor items={items} onChange={setItems} catalogProducts={catalogProducts} />

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Cost Total (RM)</label>
            <input
              type="number"
              min={0}
              value={items.length > 0 ? itemsTotal.toFixed(2) : revenueAmount}
              disabled={items.length > 0}
              onChange={(e) => setRevenueAmount(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">End Date</label>
            <input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
            <p className="text-xs text-neutral-500 mt-1.5">Set this to the date the job is officially done.</p>
          </div>
          {isScan && <SectionHeader icon={Sparkles} title="Extras" />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer has GenBlu?</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHasGenblu(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    hasGenblu
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-red-500/50"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setHasGenblu(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    !hasGenblu
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-red-500/50"
                  }`}
                >
                  No
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Services Combo sold?</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWantsCombo(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    wantsCombo
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-red-500/50"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setWantsCombo(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    !wantsCombo
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-red-500/50"
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          </div>
          {hasGenblu && (
            <div>
              {!customerName.trim() ? (
                <p className="text-xs text-amber-700">Enter the customer name above first.</p>
              ) : genbluCheckPending ? (
                <p className="text-xs text-neutral-500">Checking the GenBlu Tracker…</p>
              ) : genbluAlreadyRegistered ? (
                <p className="text-xs text-emerald-700">
                  Already registered in the GenBlu Tracker — no need to upload the screenshot again.
                </p>
              ) : (
                <div>
                  <input
                    ref={genbluFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setGenbluScreenshot(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => genbluFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
                  >
                    <Upload size={14} /> {genbluScreenshot ? genbluScreenshot.name : "Upload GenBlu Screenshot"}
                  </button>
                  <p className="text-xs text-neutral-500 mt-1.5">
                    New customer — upload their GenBlu screenshot now so it shows up automatically in the GenBlu
                    Tracker once this job is saved.
                  </p>
                </div>
              )}
            </div>
          )}
          {wantsCombo && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Package *</label>
              <div className="relative">
                <select
                  value={comboPackageId}
                  onChange={(e) => setComboPackageId(e.target.value)}
                  className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
              {packages.length === 0 && <p className="text-xs text-neutral-500 mt-1">No packages set up yet.</p>}
              <div className="mt-3">
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Receipt No</label>
                <input
                  type="text"
                  value={comboReceiptId}
                  onChange={(e) => setComboReceiptId(e.target.value)}
                  placeholder="Insert Receipt No"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>
          )}
        </div>
        {!isScan && (
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-200">
            <button
              onClick={() => router.push(redirectTo)}
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
        )}
      </div>
      {/* Sticky bottom action bar — a phone tech shouldn't have to scroll
          all the way to the end just to find Save. */}
      {isScan && (
        <div className="sticky bottom-0 mt-6 py-3 bg-white/90 backdrop-blur border-t border-neutral-200 flex items-center gap-3">
          <button
            onClick={() => router.push(redirectTo)}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-3 py-3 transition-colors shrink-0"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-sm transition-colors"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Job"}
          </button>
        </div>
      )}
    </div>
  );
}
