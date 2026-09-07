"use client";

import { useState, useTransition } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { submitPublicGenbluRegistrationAction, scanPublicGenbluScreenshotForNameAction } from "@/lib/genblu-actions";
import { BRANCHES, type Branch } from "@/lib/branch";

// Fixed roster per branch — a dropdown instead of free text keeps every
// registration's salesperson name spelled consistently (matters for
// counting/reporting later), and the short code is looked up from the
// chosen name so there's nothing extra for the salesperson to type.
const SALESPEOPLE: Record<Branch, { name: string; code: string }[]> = {
  kapar: [
    { name: "FARAH", code: "S" },
    { name: "ADRIANA", code: "AD" },
    { name: "AWIN", code: "W" },
    { name: "FAHMI", code: "SF" },
    { name: "JIMMY", code: "J-HQ" },
    { name: "LINA", code: "LN" },
    { name: "AISYAH", code: "AH" },
    { name: "SHAKIR", code: "SK" },
  ],
  setia_alam: [
    { name: "RAYMOND", code: "R" },
    { name: "NAJWA", code: "FN" },
    { name: "IMAN", code: "IN" },
    { name: "VINCENT", code: "VC" },
    { name: "DAN", code: "DN" },
  ],
  puncak_alam: [
    { name: "FAZLIN", code: "L" },
    { name: "SYAFIQ", code: "D" },
    { name: "IRFAN", code: "IR" },
    { name: "ALLINA", code: "AN" },
  ],
};

export default function GenbluSignupForm() {
  const [branch, setBranch] = useState<Branch>("kapar");
  const [salespersonName, setSalespersonName] = useState(SALESPEOPLE.kapar[0].name);
  const [customerName, setCustomerName] = useState("");
  const [customerPlateNo, setCustomerPlateNo] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [scanningName, setScanningName] = useState(false);
  const [pointsPreview, setPointsPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mismatchMessage, setMismatchMessage] = useState<string | null>(null);
  const [remark, setRemark] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleScreenshotChange(file: File | null) {
    setScreenshot(file);
    setPointsPreview(null);
    if (file) {
      setScanningName(true);
      scanPublicGenbluScreenshotForNameAction(file)
        .then((result) => {
          if (result.customerName) setCustomerName(result.customerName);
          setPointsPreview(result.pointsPreview);
        })
        .finally(() => setScanningName(false));
    }
  }

  const salespersonCode = SALESPEOPLE[branch].find((s) => s.name === salespersonName)?.code ?? "";

  function handleBranchChange(nextBranch: Branch) {
    setBranch(nextBranch);
    setSalespersonName(SALESPEOPLE[nextBranch][0].name);
  }

  function handleSubmit(confirmDuplicate = false) {
    if (!customerPlateNo.trim()) {
      setError("Enter the customer's plate number.");
      return;
    }
    if (!screenshot) {
      setError("Pick a screenshot to upload.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitPublicGenbluRegistrationAction({
        branch,
        salespersonName,
        salespersonCode,
        customerName,
        customerPlateNo,
        screenshot,
        confirmDuplicate,
        nameMismatchRemark: remark.trim() || undefined,
      });
      if ("warning" in result) {
        if (window.confirm(result.warning)) handleSubmit(true);
        return;
      }
      if ("nameMismatch" in result) {
        setMismatchMessage(result.message);
        return;
      }
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
        <p className="text-base font-semibold text-neutral-900 mb-1">Registered!</p>
        <p className="text-xs text-neutral-500 mb-5">{customerName}&apos;s GenBlu registration has been saved.</p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setCustomerName("");
            setCustomerPlateNo("");
            setScreenshot(null);
            setPointsPreview(null);
            setRemark("");
          }}
          className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          Register Another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
        <div className="relative">
          <select
            value={branch}
            onChange={(e) => handleBranchChange(e.target.value as Branch)}
            className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
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

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Your Name *</label>
        <div className="relative">
          <select
            value={salespersonName}
            onChange={(e) => setSalespersonName(e.target.value)}
            className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
          >
            {SALESPEOPLE[branch].map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">GenBlu Screenshot *</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleScreenshotChange(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
        />
        <p className="text-[11px] text-neutral-500 mt-1.5">
          {scanningName ? "Reading the customer's name off the screenshot…" : "Upload the app's home screen — the name below fills in automatically."}
        </p>
        {pointsPreview && !scanningName && <p className="text-[11px] text-amber-700 mt-1">Points read from screenshot: {pointsPreview}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name *</label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder={scanningName ? "Reading name from screenshot…" : "Fills in from the screenshot — edit if it's wrong"}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Plate No. *</label>
        <input
          type="text"
          value={customerPlateNo}
          onChange={(e) => setCustomerPlateNo(e.target.value)}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {mismatchMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5">
          <p className="text-xs text-amber-800">{mismatchMessage}</p>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={`e.g. "wife's GenBlu"`}
            className="w-full mt-2 bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isPending || !remark.trim()}
            className="w-full mt-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Uploading…" : "Confirm and Upload"}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={isPending || scanningName || !!mismatchMessage}
        className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        {isPending ? "Uploading…" : "Register"}
      </button>
    </div>
  );
}
