"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ScanLine, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { addRepairJobAction, updateRepairJobAction } from "@/lib/repairs-actions";
import { checkGenbluRegisteredAction, ensureGenbluRegistrationAction } from "@/lib/genblu-actions";
import { addPackageSaleAction } from "@/lib/packages-actions";
import type { ScannedJobsheet } from "@/lib/jobsheet-actions";
import type { RepairJob } from "@/lib/types";
import type { Mechanic, CatalogProduct, Package } from "@/lib/types";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatCurrency } from "@/lib/format";
import CatalogItemPicker from "@/components/CatalogItemPicker";

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

function ItemsEditor({
  items,
  onChange,
  catalogProducts,
}: {
  items: ItemInput[];
  onChange: (items: ItemInput[]) => void;
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
  function addCatalogProduct(product: CatalogProduct) {
    onChange([...items, { code: product.code, description: product.productName, quantity: "1", price: String(product.price) }]);
  }
  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Parts / Items</label>
      {catalogProducts.length > 0 && <CatalogItemPicker products={catalogProducts} onSelect={addCatalogProduct} />}
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

export default function WalkInJobForm({
  job,
  branchSelection,
  locked,
  mechanics,
  allActiveJobs,
  catalogProducts,
  packages,
  preferCamera = false,
  redirectTo = "/repairs/walk-in",
}: {
  job: RepairJob | null;
  branchSelection: BranchSelection;
  locked: boolean;
  mechanics: Mechanic[];
  allActiveJobs: RepairJob[];
  catalogProducts: CatalogProduct[];
  packages: Package[];
  // Jumps the scan input straight to the camera instead of a file/gallery
  // picker — only set from the standalone phone scan page (/scan), where
  // "take a photo of the jobsheet" is the whole point of the page.
  preferCamera?: boolean;
  // Where Save/Cancel send the browser afterward — the dashboard's full
  // Jobsheet list by default, but the standalone /scan page points this
  // back at itself so saving a job never drags a phone visitor into the
  // desktop dashboard's sidebar layout.
  redirectTo?: string;
}) {
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
  const [comboReceiptId, setComboReceiptId] = useState("");
  const [isPending, startTransition] = useTransition();
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
      const result: { data: ScannedJobsheet } | { error: string } = await res.json();
      if ("error" in result) {
        setScanError(result.error);
        return;
      }
      const scanned = result.data;
      setScanRawText(scanned.rawText);
      setScanSignatureDebug(scanned.signatureDebug);
      setSignatureDetected(scanned.signatureDetected);
      setSignatureConfirmed(scanned.signatureDetected === true);
      if (scanned.signatureDetected !== true) {
        window.alert(
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
      const matchedMechanic = scanned.mechanicCode
        ? mechanicCandidates.find((m) => m.shortCode.toLowerCase() === scanned.mechanicCode.toLowerCase())
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

  // A mechanic already carrying another active (non-Completed) job — of
  // either type — can't be handed a second one until it's marked Completed.
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
      scrollToField(customerNameRef.current);
      return;
    }
    if (plateNo.trim() === "") {
      scrollToField(plateNoRef.current);
      return;
    }
    if (mechanicId === "") {
      scrollToField(mechanicRef.current);
      return;
    }
    if (!signatureConfirmed) {
      scrollToField(signatureRef.current);
      return;
    }
    if (!effectiveBranch) return;
    if (hasGenblu && !genbluAlreadyRegistered && !genbluScreenshot) {
      window.alert("Upload the customer's GenBlu screenshot before saving, or switch \"Customer has GenBlu?\" to No.");
      return;
    }
    if (wantsCombo && (!comboPackageId || comboReceiptId.trim() === "")) {
      window.alert("Pick a package and enter the receipt ID, or switch \"Services Combo sold?\" to No.");
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
          const genbluResult = await ensureGenbluRegistrationAction({
            branch: effectiveBranch,
            customerName: customerName.trim(),
            customerPlateNo: plateNo.trim(),
            screenshot: genbluScreenshot,
          });
          if (genbluResult && "error" in genbluResult) {
            window.alert(`Job not saved — ${genbluResult.error}`);
            return;
          }
        } catch {
          window.alert(
            "Job not saved — couldn't verify the GenBlu screenshot (the check took too long). Please try again."
          );
          return;
        }
      }

      if (isEdit && job) {
        const result = await updateRepairJobAction(job.id, job.branch, payload);
        if (result && "error" in result) {
          window.alert(result.error);
          return;
        }
      } else {
        const result = await addRepairJobAction({ ...payload, branch: effectiveBranch, jobType: "Walk-in" });
        if ("error" in result) {
          window.alert(result.error);
          return;
        }
      }

      if (wantsCombo && comboPackageId) {
        try {
          await addPackageSaleAction({
            branch: effectiveBranch,
            packageId: comboPackageId,
            mechanicId: mechanicId || null,
            receiptId: comboReceiptId.trim(),
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
        window.alert(
          `${customerName.trim()} earned ${Math.round(finalRevenue).toLocaleString()} GenBlu points (${formatCurrency(finalRevenue)}) from this job.`
        );
      }
      router.push(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}saved=1`);
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      {!isEdit && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
              <ScanLine size={17} className="text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900">Scan Jobsheet</p>
              <p className="text-xs text-neutral-500 mt-0.5 mb-3">
                Upload a clear photo or PDF of the paper jobsheet — it'll fill in the boxes below for you to check before saving.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                // On some mobile browsers "capture" skips straight to the
                // camera app, with no way back to pick an existing photo
                // or PDF — only worth that trade-off on the dedicated
                // phone scan page, not here where desktop is common too.
                {...(preferCamera ? { capture: "environment" as const } : {})}
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
                className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Upload size={15} /> {isScanning ? "Reading jobsheet…" : "Upload Jobsheet"}
              </button>
              {scanError && <p className="text-xs text-red-700 mt-2">{scanError}</p>}
              {scanNotice && <p className="text-xs text-emerald-700 mt-2">{scanNotice}</p>}
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
                  <summary className="text-xs text-indigo-700 cursor-pointer">What Google read from the photo (for troubleshooting)</summary>
                  {scanSignatureDebug && (
                    <p className="mt-2 text-[11px] text-neutral-500 font-mono">Signature check: {scanSignatureDebug}</p>
                  )}
                  <pre className="mt-2 bg-white border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{scanRawText}</pre>
                </details>
              )}
              {scanRawText && (
                <div
                  ref={signatureRef}
                  tabIndex={-1}
                  className={`mt-3 border rounded-lg p-3 ${
                    signatureDetected === false ? "bg-red-50 border-red-200" : "bg-white border-neutral-200"
                  }`}
                >
                  {signatureDetected === true && (
                    <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Customer signature detected on the jobsheet.
                    </p>
                  )}
                  {signatureDetected === false && (
                    <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                      <AlertTriangle size={14} /> No customer sign detected — please ask the customer to sign the jobsheet before saving.
                    </p>
                  )}
                  {signatureDetected === null && (
                    <p className="text-xs text-neutral-500">
                      Couldn&apos;t check the photo for a signature — please confirm it by hand.
                    </p>
                  )}
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={signatureConfirmed}
                      onChange={(e) => setSignatureConfirmed(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    <span className="text-xs font-medium text-neutral-700">Customer has signed the jobsheet *</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Job Date</label>
            <input
              type="date"
              value={startedDate}
              onChange={(e) => setStartedDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Code</label>
            <input
              type="text"
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name *</label>
            <input
              ref={customerNameRef}
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 012-3456789"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            <p className="text-[11px] text-neutral-400 mt-1">Matches this visit to their membership card, even if the name is spelled differently.</p>
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">User ID</label>
            <input
              type="text"
              value={jobsheetUserId}
              onChange={(e) => setJobsheetUserId(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Y16ZR"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Colour</label>
            <input
              type="text"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Engine No.</label>
            <input
              type="text"
              value={engineNo}
              onChange={(e) => setEngineNo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Chassis No.</label>
            <input
              type="text"
              value={chassisNo}
              onChange={(e) => setChassisNo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Job No. (jobsheet)</label>
              <input
                type="text"
                value={jobsheetNo}
                onChange={(e) => setJobsheetNo(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Sales No.</label>
              <input
                type="text"
                value={salesNo}
                onChange={(e) => setSalesNo(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Sales Date</label>
              <input
                type="date"
                value={salesDate}
                onChange={(e) => setSalesDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Warranty Card No.</label>
              <input
                type="text"
                value={warrantyCardNo}
                onChange={(e) => setWarrantyCardNo(e.target.value)}
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
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Next Mileage (KM)</label>
              <input
                type="text"
                value={nextMileageKm}
                onChange={(e) => setNextMileageKm(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Service Type</label>
              <input
                type="text"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="e.g. NORMAL SERVICE"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Next Service Date</label>
              <input
                type="date"
                value={nextServiceDate}
                onChange={(e) => setNextServiceDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
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
                      ? "bg-indigo-500 border-indigo-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-indigo-500/50"
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
                      ? "bg-indigo-500 border-indigo-500 text-white"
                      : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-indigo-500/50"
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
            <select
              ref={mechanicRef}
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
                Marked as a heavy / big item repair — only Heavy Repair mechanics can be assigned.
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
              Big / heavy item repair — only Heavy Repair mechanics can be assigned
            </label>
          </div>

          <ItemsEditor items={items} onChange={setItems} catalogProducts={catalogProducts} />

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Cost Total (RM)</label>
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
            <p className="text-xs text-neutral-500 mt-1.5">Set this to the date the job is officially done.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer has GenBlu?</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHasGenblu(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  hasGenblu
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-indigo-500/50"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setHasGenblu(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  !hasGenblu
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-indigo-500/50"
                }`}
              >
                No
              </button>
            </div>
            {hasGenblu && (
              <>
                {!customerName.trim() ? (
                  <p className="text-xs text-amber-700 mt-1.5">Enter the customer name above first.</p>
                ) : genbluCheckPending ? (
                  <p className="text-xs text-neutral-500 mt-1.5">Checking the GenBlu Tracker…</p>
                ) : genbluAlreadyRegistered ? (
                  <p className="text-xs text-emerald-700 mt-1.5">
                    Already registered in the GenBlu Tracker — no need to upload the screenshot again.
                  </p>
                ) : (
                  <div className="mt-2">
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
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Services Combo sold?</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWantsCombo(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  wantsCombo
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-indigo-500/50"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWantsCombo(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  !wantsCombo
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-indigo-500/50"
                }`}
              >
                No
              </button>
            </div>
            {wantsCombo && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Package *</label>
                  <select
                    value={comboPackageId}
                    onChange={(e) => setComboPackageId(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                  >
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.price)}
                      </option>
                    ))}
                  </select>
                  {packages.length === 0 && <p className="text-xs text-neutral-500 mt-1">No packages set up yet.</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Receipt ID *</label>
                  <input
                    type="text"
                    value={comboReceiptId}
                    onChange={(e) => setComboReceiptId(e.target.value)}
                    placeholder="e.g. CSA030927"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
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
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Job"}
          </button>
        </div>
      </div>
    </div>
  );
}
