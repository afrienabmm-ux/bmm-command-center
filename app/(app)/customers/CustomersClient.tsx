"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Pencil, Trash2, CreditCard, X, Link2, Check, ArrowUpDown, ChevronDown, Wrench } from "lucide-react";
import { addCustomerCardAction, updateCustomerCardAction, deleteCustomerCardAction, setCardStampsAction } from "@/lib/customers-actions";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate } from "@/lib/format";
import { stampCardSize, rewardForStamp, nextReward } from "@/lib/membership";
import type { CustomerCard } from "@/lib/types";

export default function CustomersClient({
  customers,
  branch,
  branchSelection,
  locked,
  canManageCards,
}: {
  customers: CustomerCard[];
  branch: Branch;
  branchSelection: BranchSelection;
  locked: boolean;
  canManageCards: boolean;
}) {
  const [query, setQuery] = useState("");
  const [cardModalFor, setCardModalFor] = useState<CustomerCard | "new" | null>(null);
  const [deleting, setDeleting] = useState<CustomerCard | null>(null);
  const [isPending, startTransition] = useTransition();
  const [linkCopied, setLinkCopied] = useState(false);
  const [stampModalFor, setStampModalFor] = useState<CustomerCard | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "issued">("issued");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const showAllBranches = branchSelection === "all";

  function handleCopyLink() {
    const url = `${window.location.origin}/join`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? customers.filter(
          (c) =>
            c.customerName.toLowerCase().includes(q) ||
            c.plateNo.toLowerCase().includes(q) ||
            c.customerPhone.toLowerCase().includes(q)
        )
      : customers;
    return [...filtered].sort((a, b) => {
      const cmp = sortBy === "name" ? a.customerName.localeCompare(b.customerName) : a.issuedDate.localeCompare(b.issuedDate);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [customers, query, sortBy, sortDir]);

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      await deleteCustomerCardAction(deleting.id, deleting.branch);
      setDeleting(null);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, plate, or phone…"
              className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-64"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "issued")}
              className="appearance-none bg-white border border-neutral-200 hover:border-red-300 rounded-xl pl-3 pr-8 py-2 text-sm text-neutral-700 font-medium focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
            >
              <option value="issued">Sort: Issued Date</option>
              <option value="name">Sort: Name</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            title="Toggle sort direction"
          >
            <ArrowUpDown size={14} /> {sortDir === "desc" ? "Newest" : "Oldest"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {linkCopied ? <Check size={15} className="text-emerald-600" /> : <Link2 size={15} />}
            {linkCopied ? "Link copied" : "Copy Sign-Up Link"}
          </button>
          {canManageCards && (
            <button
              onClick={() => setCardModalFor("new")}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus size={15} /> New Services Card
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-neutral-500 mb-4 -mt-2">
        Share this link with customers so they can register themselves and get a digital card — no app needed.
      </p>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Plate No.</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Services Card</th>
              <th className="px-4 py-3">Issued</th>
              {canManageCards && <th className="px-4 py-3 w-20"></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-4 py-3 font-medium text-neutral-800">
                  {c.customerName}
                  {showAllBranches && (
                    <span className="ml-2 text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded-full px-1.5 py-0.5 align-middle">
                      {branchLabel(c.branch)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600">{c.customerPhone || "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{c.plateNo || "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{c.model || "—"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setStampModalFor(c)}
                    title="Click to tick stamps"
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 hover:bg-red-500/20 transition-colors"
                  >
                    <CreditCard size={11} />{" "}
                    {`Stamp ${c.stamps.length}/10${nextReward(c.stamps.length) ? ` — next: ${nextReward(c.stamps.length)!.label}` : ""}`}
                  </button>
                </td>
                <td className="px-4 py-3 text-neutral-500">{c.issuedDate ? formatDate(c.issuedDate) : "—"}</td>
                {canManageCards && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setCardModalFor(c)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                        title="Edit services card"
                        aria-label="Edit services card"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                        title="Delete services card"
                        aria-label="Delete services card"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-neutral-500">
                  {customers.length === 0 ? "No services cards yet." : "No customers match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cardModalFor && (
        <CardModal
          customer={cardModalFor === "new" ? null : cardModalFor}
          branch={branch}
          locked={locked}
          onClose={() => setCardModalFor(null)}
        />
      )}

      {stampModalFor && <StampModal card={stampModalFor} onClose={() => setStampModalFor(null)} />}

      {deleting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete this services card?</h2>
            <p className="text-sm text-neutral-600 mb-6">
              <span className="text-neutral-800 font-medium">{deleting.customerName}</span>&apos;s services card
              will be permanently removed. This can&apos;t be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardModal({
  customer,
  branch,
  locked,
  onClose,
}: {
  customer: CustomerCard | null;
  branch: Branch;
  locked: boolean;
  onClose: () => void;
}) {
  const existing = customer;
  const [cardBranch, setCardBranch] = useState<Branch>(customer?.branch ?? branch);
  const [customerName, setCustomerName] = useState(existing?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(existing?.customerPhone ?? "");
  const [cardNumber, setCardNumber] = useState(existing?.cardNumber ?? "");
  const [plateNo, setPlateNo] = useState(existing?.plateNo ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [boughtBikeHere, setBoughtBikeHere] = useState(existing?.boughtBikeHere ?? false);
  const [issuedDate, setIssuedDate] = useState(existing?.issuedDate ?? new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(existing?.expiryDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const input = {
      branch: cardBranch,
      customerName,
      customerPhone,
      cardNumber,
      plateNo,
      model,
      boughtBikeHere,
      issuedDate,
      expiryDate: expiryDate || null,
      notes: existing?.notes ?? "",
    };
    startTransition(async () => {
      const result = existing
        ? await updateCustomerCardAction(existing.id, existing.branch, input)
        : await addCustomerCardAction(input);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-neutral-900">
            {existing ? "Edit Services Card" : "New Services Card"}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
            <select
              value={cardBranch}
              onChange={(e) => setCardBranch(e.target.value as Branch)}
              disabled={locked}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-60"
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name *</label>
            <input
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
            {existing && (
              <p className="text-[11px] text-neutral-400 mt-1.5">
                Changed their number? Update it here — they&apos;ll use the new one to check their card on /join.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Plate No.</label>
              <input
                type="text"
                value={plateNo}
                onChange={(e) => setPlateNo(e.target.value)}
                placeholder="e.g. VQY 4011"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Y15ZR"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Card No.</label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div className="flex items-start gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-3">
            <input
              id="bought-bike-here"
              type="checkbox"
              checked={boughtBikeHere}
              onChange={(e) => setBoughtBikeHere(e.target.checked)}
              className="accent-red-500 mt-0.5"
            />
            <label htmlFor="bought-bike-here" className="text-xs text-neutral-700">
              <span className="font-medium">Bought their bike with us *</span>
              <br />
              <span className="text-neutral-500">Only bike-buyers are eligible for the stamp-reward card.</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Issued</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Expiry</label>
              <input
                type="date"
                value={expiryDate ?? ""}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-700 mt-4">{error}</p>}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !customerName.trim() || !boughtBikeHere}
            className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Stamps are ticked by hand here, one click at a time — completely
// independent of jobsheet/visit counts.
function StampModal({ card, onClose }: { card: CustomerCard; onClose: () => void }) {
  const [stamps, setStamps] = useState<number[]>(card.stamps);
  const [isPending, startTransition] = useTransition();
  const size = stampCardSize();
  const complete = stamps.length >= size;
  const upcoming = nextReward(stamps.length);

  function save(next: number[]) {
    setStamps(next);
    startTransition(async () => {
      await setCardStampsAction(card.id, card.branch, next);
    });
  }

  function toggle(stampNo: number) {
    const next = stamps.includes(stampNo) ? stamps.filter((n) => n !== stampNo) : [...stamps, stampNo];
    save(next);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-neutral-900">{card.customerName}&apos;s Stamp Card</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-4">{card.cardNumber || "No card number"}</p>

        <div className="grid grid-cols-5 gap-2.5">
          {Array.from({ length: size }).map((_, i) => {
            const stampNo = i + 1;
            const reward = rewardForStamp(stampNo);
            const filled = stamps.includes(stampNo);
            return (
              <button
                key={stampNo}
                type="button"
                onClick={() => toggle(stampNo)}
                disabled={isPending}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-colors ${
                  filled
                    ? "bg-gradient-to-br from-red-500 to-rose-600 border-red-500 text-white"
                    : "bg-neutral-50 border-neutral-200 text-neutral-400 hover:border-red-300"
                }`}
                title={reward ?? `Stamp ${stampNo}`}
              >
                {filled ? <Wrench size={14} /> : <span className="text-xs font-semibold">{stampNo}</span>}
                {reward && <span className="text-[8px] leading-tight text-center px-0.5">{reward}</span>}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-neutral-500 mt-4 text-center">
          {complete
            ? "Card complete — reset it once the reward's been redeemed."
            : upcoming
              ? `Next reward: ${upcoming.label} at stamp ${upcoming.stamp}.`
              : ""}
        </p>

        <div className="flex items-center justify-between gap-3 mt-5">
          {complete ? (
            <button
              onClick={() => save([])}
              disabled={isPending}
              className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              Start New Card
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
