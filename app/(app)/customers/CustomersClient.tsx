"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Pencil, Trash2, CreditCard, X, Link2, Check, Mail, ArrowUpDown } from "lucide-react";
import { addCustomerCardAction, updateCustomerCardAction, deleteCustomerCardAction, sendPromotionAction } from "@/lib/customers-actions";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate, formatCurrency } from "@/lib/format";
import { stampsOnCurrentCard, nextReward } from "@/lib/membership";
import type { CustomerSummary, CustomerCard } from "@/lib/types";

export default function CustomersClient({
  customers,
  branch,
  branchSelection,
  locked,
}: {
  customers: CustomerSummary[];
  branch: Branch;
  branchSelection: BranchSelection;
  locked: boolean;
}) {
  const [query, setQuery] = useState("");
  const [cardModalFor, setCardModalFor] = useState<CustomerSummary | "new" | null>(null);
  const [deleting, setDeleting] = useState<CustomerCard | null>(null);
  const [isPending, startTransition] = useTransition();
  const [linkCopied, setLinkCopied] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"spend" | "visit">("spend");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const showAllBranches = branchSelection === "all";
  const emailableCount = customers.filter((c) => c.card?.customerEmail).length;

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
            c.name.toLowerCase().includes(q) ||
            c.plates.some((p) => p.toLowerCase().includes(q)) ||
            (c.card?.customerPhone ?? "").toLowerCase().includes(q)
        )
      : customers;
    return [...filtered].sort((a, b) => {
      const cmp = sortBy === "spend" ? a.totalSpend - b.totalSpend : a.lastVisit.localeCompare(b.lastVisit);
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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "spend" | "visit")}
            className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
          >
            <option value="spend">Sort: Total Spend</option>
            <option value="visit">Sort: Last Visit</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            title="Toggle sort direction"
          >
            <ArrowUpDown size={14} /> {sortDir === "desc" ? "Highest" : "Lowest"}
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
          {!locked && (
            <button
              onClick={() => setPromoModalOpen(true)}
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <Mail size={15} /> Send Promotion
            </button>
          )}
          <button
            onClick={() => setCardModalFor("new")}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus size={15} /> New Services Card
          </button>
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
              <th className="px-4 py-3">Plates</th>
              <th className="px-4 py-3 text-center">Visits</th>
              <th className="px-4 py-3 text-center">Total Spend</th>
              <th className="px-4 py-3">Packages Bought</th>
              <th className="px-4 py-3">Services Card</th>
              <th className="px-4 py-3">Last Visit</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const rowKey = `${c.branch}-${c.name.toLowerCase()}`;
              const revealed = revealedKey === rowKey;
              return (
              <tr key={rowKey} className="border-t border-neutral-100">
                <td className="px-4 py-3 font-medium text-neutral-800">
                  {c.name}
                  {showAllBranches && (
                    <span className="ml-2 text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded-full px-1.5 py-0.5 align-middle">
                      {branchLabel(c.branch)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600">{c.card?.customerPhone || "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{c.plates.join(", ") || "—"}</td>
                <td className="px-4 py-3 text-neutral-600 text-center">{c.jobCount}</td>
                <td className="px-4 py-3 text-neutral-800 font-medium text-center">{formatCurrency(c.totalSpend)}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {c.packagesBought.length > 0
                    ? c.packagesBought.map((p) => `${p.name} ×${p.count}`).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {c.card ? (
                    <button
                      type="button"
                      onClick={() => setRevealedKey(revealed ? null : rowKey)}
                      title="Click to show the card code"
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 hover:bg-red-500/20 transition-colors"
                    >
                      <CreditCard size={11} />{" "}
                      {revealed
                        ? c.card.cardNumber || "No code"
                        : `Stamp ${stampsOnCurrentCard(c.jobCount)}/10${
                            nextReward(stampsOnCurrentCard(c.jobCount)) ? ` — next: ${nextReward(stampsOnCurrentCard(c.jobCount))!.label}` : ""
                          }`}
                      {!revealed && c.card.expiryDate ? ` · exp ${formatDate(c.card.expiryDate)}` : ""}
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-400">No card</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-500">{c.lastVisit ? formatDate(c.lastVisit) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setCardModalFor(c)}
                      className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                      title={c.card ? "Edit services card" : "Add services card"}
                      aria-label={c.card ? "Edit services card" : "Add services card"}
                    >
                      <Pencil size={14} />
                    </button>
                    {c.card && (
                      <button
                        onClick={() => setDeleting(c.card)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                        title="Delete services card"
                        aria-label="Delete services card"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-neutral-500">
                  {customers.length === 0 ? "No customers yet." : "No customers match your search."}
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

      {promoModalOpen && (
        <PromoModal
          branchSelection={branchSelection}
          recipientCount={emailableCount}
          onClose={() => setPromoModalOpen(false)}
        />
      )}

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
  customer: CustomerSummary | null;
  branch: Branch;
  locked: boolean;
  onClose: () => void;
}) {
  const existing = customer?.card ?? null;
  const [cardBranch, setCardBranch] = useState<Branch>(customer?.branch ?? branch);
  const [customerName, setCustomerName] = useState(customer?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(existing?.customerPhone ?? "");
  const [customerEmail, setCustomerEmail] = useState(existing?.customerEmail ?? "");
  const [cardNumber, setCardNumber] = useState(existing?.cardNumber ?? "");
  const [plateNo, setPlateNo] = useState(existing?.plateNo ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [boughtBikeHere, setBoughtBikeHere] = useState(existing?.boughtBikeHere ?? false);
  const [issuedDate, setIssuedDate] = useState(existing?.issuedDate ?? new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(existing?.expiryDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameLocked = customer !== null;

  function handleSave() {
    const input = {
      branch: cardBranch,
      customerName,
      customerPhone,
      customerEmail: customerEmail.trim(),
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
          {!nameLocked && (
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
          )}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Customer Name *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={nameLocked}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-60"
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Email (optional)</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@email.com"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
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

function PromoModal({
  branchSelection,
  recipientCount,
  onClose,
}: {
  branchSelection: BranchSelection;
  recipientCount: number;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sentCount: number; failedCount: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePosterChange(file: File | null) {
    setPoster(file);
    setPosterPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("branchSelection", branchSelection);
      formData.set("subject", subject);
      formData.set("message", message);
      if (poster) formData.set("poster", poster);
      const res = await sendPromotionAction(formData);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-neutral-900">Send Promotion</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="py-4 text-center">
            <p className="text-sm text-neutral-800 font-medium">
              Sent to {result.sentCount} member{result.sentCount === 1 ? "" : "s"}
              {result.failedCount > 0 ? `, ${result.failedCount} failed` : ""}.
            </p>
            <button
              onClick={onClose}
              className="mt-4 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-neutral-500 mb-4">
              Emails {recipientCount} member{recipientCount === 1 ? "" : "s"} with an email on file
              {branchSelection === "all" ? " across all branches" : ""} — anyone who signed up through the
              services card link.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. This weekend only: 20% off oil change"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Write your promotion here…"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Poster (optional)</label>
                {posterPreview && (
                  <div className="relative mb-2 w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={posterPreview} alt="Poster preview" className="w-full max-h-48 object-contain rounded-lg border border-neutral-200" />
                    <button
                      type="button"
                      onClick={() => handlePosterChange(null)}
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                      aria-label="Remove poster"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePosterChange(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-800 file:text-xs"
                />
                <p className="text-[11px] text-neutral-400 mt-1">Shown below your message in the email.</p>
              </div>
            </div>

            {error && <p className="text-sm text-red-700 mt-3">{error}</p>}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isPending || !subject.trim() || !message.trim() || recipientCount === 0}
                className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? "Sending…" : `Send to ${recipientCount}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
