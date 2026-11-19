"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { addGenbluTransactionAction } from "@/lib/genblu-actions";
import { type Branch, type BranchSelection } from "@/lib/branch";
import { PhotoPicker, BranchPicker, Toggle, primaryButton } from "./scan-ui";
import { formatDate } from "@/lib/format";
import type { GenbluTransaction } from "@/lib/types";

// Every field here is read straight off the screenshot by OCR — none of
// them are editable, on purpose (photo evidence, not typed numbers). Branch
// is the one field admin still picks, since it's never shown on the GenBlu
// app screen itself.
export default function GenbluTransactionForm({ branchSelection }: { branchSelection: BranchSelection }) {
  const [branch, setBranch] = useState<Branch>(branchSelection === "all" ? "kapar" : branchSelection);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [serviceCoupon, setServiceCoupon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenbluTransaction | null>(null);
  const [trackerUpdated, setTrackerUpdated] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const locked = branchSelection !== "all";

  function handleSubmit(confirmDuplicate = false) {
    if (!screenshot) {
      setError("Pick a screenshot to upload.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addGenbluTransactionAction({ branch, screenshot, serviceCoupon, confirmDuplicate });
      if ("warning" in res) {
        if (window.confirm(res.warning)) handleSubmit(true);
        return;
      }
      setRawText(res.rawText ?? null);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res.transaction);
      setTrackerUpdated(res.trackerUpdated);
      setScreenshot(null);
      setServiceCoupon(false);
    });
  }

  if (result) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-5">
        <p className="text-base font-semibold text-emerald-700 flex items-center gap-2 mb-1">
          <CheckCircle2 size={18} aria-hidden="true" /> Points saved
        </p>
        <p className="text-sm text-neutral-500 mb-4">
          {trackerUpdated ? "The customer's GenBlu total was updated too." : "No sign-up found for this name, so only the points were saved."}
        </p>
        <div className="text-sm">
          <Field label="Customer" value={result.customerName} />
          <Field label="Membership no." value={result.membershipNumber ?? "—"} />
          <Field label="Category" value={result.productCategory ?? "—"} />
          <Field label="Points" value={String(result.points)} />
          <Field label="Date" value={result.transactionDate ? formatDate(result.transactionDate) : "—"} />
          <Field label="Time" value={result.transactionTime ?? "—"} />
          <Field label="Service coupon" value={result.serviceCoupon ? "Yes" : "No"} />
        </div>
        {rawText && (
          <details className="mt-3">
            <summary className="text-xs text-neutral-500 cursor-pointer">What Google read from the photo (for troubleshooting)</summary>
            <pre className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{rawText}</pre>
          </details>
        )}
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setRawText(null);
            setTrackerUpdated(false);
          }}
          className="w-full mt-5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-base font-medium px-4 py-3 rounded-xl transition-colors"
        >
          Upload another
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-5">
      <div>
        <p className="text-base font-semibold text-neutral-900">Points from a service</p>
        <p className="text-sm text-neutral-500 mt-0.5">Photo the GenBlu points screen. Customer, points and date fill in by themselves</p>
      </div>
      <PhotoPicker file={screenshot} onChange={setScreenshot} hint="The screen showing the points just given" />
      <BranchPicker value={branch} onChange={setBranch} locked={locked} />
      <Toggle label="Customer used a service coupon" on={serviceCoupon} onChange={setServiceCoupon} />

      {error && <p className="text-sm text-red-700">{error}</p>}
      {error && rawText && (
        <details>
          <summary className="text-xs text-neutral-500 cursor-pointer">What Google read from the photo (for troubleshooting)</summary>
          <pre className="mt-2 bg-white border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{rawText}</pre>
        </details>
      )}

      <button type="button" onClick={() => handleSubmit()} disabled={isPending || !screenshot} className={primaryButton}>
        {isPending ? "Reading screenshot…" : "Upload screenshot"}
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-b-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-neutral-800 font-medium">{value}</span>
    </div>
  );
}
