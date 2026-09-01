"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, Search } from "lucide-react";
import { attachGenbluScreenshotAction, scanGenbluScreenshotForNameAction } from "@/lib/genblu-actions";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate } from "@/lib/format";

export type RecentJobsheetCustomer = {
  jobId: string;
  branch: Branch;
  customerName: string;
  customerPlateNo: string;
  date: string;
};

// Deliberately just a picker plus a file — the jobsheet form already
// collects the customer's name, plate, and branch, so re-typing them here
// would just be re-entering data that's already on file. Picking the
// jobsheet and reusing ensureGenbluRegistrationAction (the same action the
// jobsheet form's own "Customer has GenBlu?" toggle calls) keeps this in
// sync with that flow instead of being a second, divergent way to
// register someone. "No jobsheet" is the one case that genuinely needs its
// own fields — a brand new customer signing up for GenBlu without getting
// a service done, so there's no jobsheet to pick from at all.
export default function GenbluQuickForm({
  recentJobs,
  branchSelection,
}: {
  recentJobs: RecentJobsheetCustomer[];
  branchSelection: BranchSelection;
}) {
  const [hasJobsheet, setHasJobsheet] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(recentJobs[0]?.jobId ?? "");
  const [manualBranch, setManualBranch] = useState<Branch>(branchSelection === "all" ? "kapar" : branchSelection);
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualPlateNo, setManualPlateNo] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [scanningName, setScanningName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  // For a brand new customer there's no jobsheet to pull the name from —
  // but the screenshot itself (the GenBlu app's home screen) already shows
  // it printed right at the top, so reading it off there beats asking
  // staff to retype what they can already see on the photo they just took.
  function handleScreenshotChange(file: File | null) {
    setScreenshot(file);
    if (file && !hasJobsheet) {
      setScanningName(true);
      scanGenbluScreenshotForNameAction(file)
        .then((result) => {
          if (result.customerName) setManualCustomerName(result.customerName);
        })
        .finally(() => setScanningName(false));
    }
  }

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recentJobs;
    return recentJobs.filter(
      (j) => j.customerName.toLowerCase().includes(q) || j.customerPlateNo.toLowerCase().includes(q)
    );
  }, [recentJobs, search]);

  // Keep the actual selection in sync with the visible list — if a search
  // filters out whatever was picked, the dropdown itself no longer shows it
  // as an option, so silently submitting the old (hidden) pick would be
  // confusing. Falls back to the first still-visible match instead.
  useEffect(() => {
    if (!filteredJobs.some((j) => j.jobId === selectedId)) {
      setSelectedId(filteredJobs[0]?.jobId ?? "");
    }
  }, [filteredJobs, selectedId]);

  const selected = recentJobs.find((j) => j.jobId === selectedId) ?? null;
  const branchLocked = branchSelection !== "all";

  function handleSubmit() {
    if (!screenshot) {
      setError("Pick a screenshot to upload.");
      return;
    }
    const input = hasJobsheet
      ? selected && { branch: selected.branch, customerName: selected.customerName, customerPlateNo: selected.customerPlateNo }
      : { branch: manualBranch, customerName: manualCustomerName.trim(), customerPlateNo: manualPlateNo.trim() };
    if (!input) return;
    if (!hasJobsheet && !input.customerName) {
      setError("Customer name is required.");
      return;
    }
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await attachGenbluScreenshotAction({ ...input, screenshot });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
      setScreenshot(null);
      if (!hasJobsheet) {
        setManualCustomerName("");
        setManualPlateNo("");
      }
    });
  }

  const canSubmit = hasJobsheet ? !!selected && !!screenshot : !!manualCustomerName.trim() && !!screenshot;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-neutral-900">Upload GenBlu Screenshot</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">
        {hasJobsheet ? "Pick the customer's jobsheet, then upload their points screenshot." : "Register a new customer who doesn't have a jobsheet, then upload their points screenshot."}
      </p>

      <div className="flex gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-4">
        <button
          type="button"
          onClick={() => setHasJobsheet(true)}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            hasJobsheet ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          Has Jobsheet
        </button>
        <button
          type="button"
          onClick={() => setHasJobsheet(false)}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            !hasJobsheet ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          No Jobsheet — New Customer
        </button>
      </div>

      {hasJobsheet ? (
        recentJobs.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-6">No recent jobsheets yet — add one under Scan Jobsheet first.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Search by name or plate</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type a name or plate no…"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer / Jobsheet *</label>
              <div className="relative">
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
                >
                  {filteredJobs.length === 0 && <option value="">No matches</option>}
                  {filteredJobs.map((j) => (
                    <option key={j.jobId} value={j.jobId}>
                      {j.customerName || "—"} · {j.customerPlateNo} · {branchLabel(j.branch)} · {formatDate(j.date)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Points Screenshot *</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleScreenshotChange(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
            />
            <p className="text-[11px] text-neutral-500 mt-1.5">
              {scanningName ? "Reading the customer's name off the screenshot…" : "Upload the app's home screen — the name below fills in automatically."}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
            <div className="relative">
              <select
                value={manualBranch}
                onChange={(e) => setManualBranch(e.target.value as Branch)}
                disabled={branchLocked}
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
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name *</label>
            <input
              type="text"
              value={manualCustomerName}
              onChange={(e) => setManualCustomerName(e.target.value)}
              placeholder={scanningName ? "Reading name from screenshot…" : "Fills in from the screenshot — edit if it's wrong"}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Plate No.</label>
            <input
              type="text"
              value={manualPlateNo}
              onChange={(e) => setManualPlateNo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
        </div>
      )}

      {hasJobsheet && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Points Screenshot *</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleScreenshotChange(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-700 mt-4">{error}</p>}
      {done && !isPending && (
        <p className="text-sm text-emerald-700 flex items-center gap-1.5 mt-4">
          <CheckCircle2 size={15} /> Screenshot uploaded.
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || scanningName || !canSubmit}
        className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors mt-4"
      >
        {isPending ? "Uploading…" : "Upload"}
      </button>
    </div>
  );
}
