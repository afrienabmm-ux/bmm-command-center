"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
import { attachGenbluScreenshotAction, scanGenbluScreenshotForNameAction } from "@/lib/genblu-actions";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { PhotoPicker, BranchPicker, primaryButton } from "./scan-ui";
import { formatDate } from "@/lib/format";
import { looseIncludes } from "@/lib/search";

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
  forceNewCustomer,
}: {
  recentJobs: RecentJobsheetCustomer[];
  branchSelection: BranchSelection;
  // Sales Advisor's only task is registering brand new customers who don't
  // have a jobsheet yet — no toggle to even show them, just the "No
  // Jobsheet — New Customer" fields, always.
  forceNewCustomer?: boolean;
}) {
  // Chosen on the panel above ("Sign-up, has a jobsheet" / "new customer").
  const hasJobsheet = !forceNewCustomer;
  const [readName, setReadName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Nobody is picked until admin taps a jobsheet (or the screenshot name matches one).
  const [selectedId, setSelectedId] = useState("");
  const [manualBranch, setManualBranch] = useState<Branch>(branchSelection === "all" ? "kapar" : branchSelection);
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualPlateNo, setManualPlateNo] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [scanningName, setScanningName] = useState(false);
  const [pointsPreview, setPointsPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when the screenshot's name doesn't match the customer — the
  // upload isn't blocked, but staff need to type a short reason (e.g.
  // "wife's GenBlu") before it's allowed through.
  const [mismatchMessage, setMismatchMessage] = useState<string | null>(null);
  const [remark, setRemark] = useState("");
  const [isPending, startTransition] = useTransition();

  // For a brand new customer there's no jobsheet to pull the name from —
  // but the screenshot itself (the GenBlu app's home screen) already shows
  // it printed right at the top, so reading it off there beats asking
  // staff to retype what they can already see on the photo they just took.
  // The points figure shown here is a preview only — the real save on
  // submit re-reads the screenshot itself, this just shows staff up front
  // what that reading looks like.
  function handleScreenshotChange(file: File | null) {
    setScreenshot(file);
    setPointsPreview(null);
    setReadName(null);
    if (file) {
      setScanningName(true);
      scanGenbluScreenshotForNameAction(file)
        .then((result) => {
          setPointsPreview(result.pointsPreview);
          setReadName(result.customerName || null);
          if (!hasJobsheet) {
            if (result.customerName) setManualCustomerName(result.customerName);
          } else if (result.customerName) {
            // Pre-pick the jobsheet whose name best matches the screenshot.
            const words = (n: string) => n.toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !["BIN", "BINTI", "BT", "BN", "A/L", "A/P"].includes(w));
            const want = words(result.customerName);
            let best: { id: string; score: number } | null = null;
            for (const j of recentJobs) {
              const have = words(j.customerName);
              const score = want.filter((w) => have.includes(w)).length;
              if (score > 0 && (!best || score > best.score)) best = { id: j.jobId, score };
            }
            if (best && best.score >= Math.min(2, want.length)) {
              setSearch("");
              setSelectedId(best.id);
            }
          }
        })
        .finally(() => setScanningName(false));
    }
  }

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    // With no search typed, only the last 2 days show — the point of
    // this list is picking today's (or yesterday's late) customer, not
    // scrolling through everyone. Typing a plate or name reaches back
    // through the whole list regardless of age, since a search is
    // deliberate — staff already know who/what they're looking for.
    if (!q) {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const cutoff = twoDaysAgo.toISOString().slice(0, 10);
      return recentJobs.filter((j) => j.date >= cutoff);
    }
    return recentJobs.filter(
      (j) => j.customerName.toLowerCase().includes(q) || looseIncludes(j.customerPlateNo, q)
    );
  }, [recentJobs, search]);

  // The picked jobsheet always stays at the top of the list (see shownJobs),
  // so searching never silently swaps who the screenshot goes to.
  const selected = recentJobs.find((j) => j.jobId === selectedId) ?? null;
  const shownJobs = (selected && !filteredJobs.some((j) => j.jobId === selected.jobId) ? [selected, ...filteredJobs] : filteredJobs).slice(0, 8);
  const branchLocked = branchSelection !== "all";

  function handleSubmit(confirmDuplicate = false) {
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
    startTransition(async () => {
      const result = await attachGenbluScreenshotAction({
        ...input,
        screenshot,
        hasJobsheet,
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
      setMismatchMessage(null);
      setRemark("");
      // A real page load, not just clearing local state — the file input
      // above stays showing the old filename even after screenshot is
      // reset to null (browsers don't let React control that value), which
      // looked like the same photo was still sitting there ready to
      // re-upload. A hard reload guarantees a genuinely blank form, same
      // as browsing back to the page — SavedToast (already on this page)
      // picks up ?genblu_saved=1 and shows the confirmation once it's back.
      window.location.href = `${window.location.pathname}?genblu_saved=1`;
    });
  }

  const canSubmit = hasJobsheet ? !!selected && !!screenshot : !!manualCustomerName.trim() && !!screenshot;

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-5">
      <div>
        <p className="text-base font-semibold text-neutral-900">{hasJobsheet ? "Sign-up with a jobsheet" : "Sign-up, new customer"}</p>
        <p className="text-sm text-neutral-500 mt-0.5">
          {hasJobsheet ? "Photo the GenBlu app screen, then pick the customer's jobsheet" : "Photo the GenBlu app home screen. The name fills in by itself"}
        </p>
      </div>

      <PhotoPicker file={screenshot} onChange={handleScreenshotChange} hint="The GenBlu app screen with the customer's name and points" />
      {screenshot && (
        <p className={`text-sm ${scanningName ? "text-neutral-500" : readName ? "text-neutral-700" : "rounded-lg bg-amber-50 px-3 py-2 text-amber-800"}`}>
          {scanningName
            ? "Reading the screenshot…"
            : readName
              ? <>Read from screenshot: <span className="font-medium text-neutral-900">{readName}</span>{pointsPreview ? <> · {pointsPreview}</> : null}</>
              : "Couldn't read the name from this screenshot. Check the picture, or type the name below."}
        </p>
      )}
      {screenshot && !scanningName && pointsPreview?.includes("current balance") && (
        <p className="-mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This is the home screen: fine for the sign-up, but it won&apos;t count as a point allocation. Points earned today need the screen showing the points given.
        </p>
      )}

      {hasJobsheet ? (
        recentJobs.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-6">No recent jobsheets yet. Add one under Scan Jobsheet first.</p>
        ) : (
          <div>
            <p className="text-xs font-medium text-neutral-600 mb-1.5">Customer&apos;s jobsheet *</p>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or plate"
                className="w-full bg-white border border-neutral-300 rounded-xl pl-9 pr-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/60"
              />
            </div>
            <ul className="mt-2 space-y-1.5">
              {shownJobs.map((j) => {
                const on = j.jobId === selectedId;
                return (
                  <li key={j.jobId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(j.jobId)}
                      aria-pressed={on}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                        on ? "border-red-600 bg-red-50" : "border-neutral-200 bg-white hover:border-neutral-300"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm truncate ${on ? "font-medium text-red-900" : "text-neutral-900"}`}>{j.customerName || "No name"}</span>
                        <span className="block text-xs text-neutral-500">
                          {j.customerPlateNo} · {branchLabel(j.branch)} · {formatDate(j.date)}
                        </span>
                      </span>
                      {on && <Check size={16} className="text-red-600 shrink-0" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
              {shownJobs.length === 0 && (
                <li className="text-sm text-neutral-500 py-3">{search.trim() ? "No jobsheet matches that name or plate." : "No jobsheets in the last 2 days. Search by name or plate."}</li>
              )}
            </ul>
            {!search.trim() && <p className="text-xs text-neutral-500 mt-2">Showing the last 2 days. Search to find older jobsheets.</p>}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <BranchPicker value={manualBranch} onChange={setManualBranch} locked={branchLocked} />
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer name *</label>
            <input
              type="text"
              value={manualCustomerName}
              onChange={(e) => setManualCustomerName(e.target.value)}
              placeholder={scanningName ? "Reading name from screenshot…" : "Fills in from the screenshot"}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Plate no.</label>
            <input
              type="text"
              value={manualPlateNo}
              onChange={(e) => setManualPlateNo(e.target.value)}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/60"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {mismatchMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <p className="text-sm text-amber-800">{mismatchMessage}</p>
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
            className="w-full mt-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {isPending ? "Uploading…" : "Confirm and upload"}
          </button>
        </div>
      )}

      <button type="button" onClick={() => handleSubmit()} disabled={isPending || scanningName || !canSubmit || !!mismatchMessage} className={primaryButton}>
        {isPending ? "Uploading…" : "Upload screenshot"}
      </button>
    </div>
  );
}
