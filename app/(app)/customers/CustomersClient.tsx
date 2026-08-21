"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Pencil, Trash2, CreditCard, X } from "lucide-react";
import { addCustomerCardAction, updateCustomerCardAction, deleteCustomerCardAction } from "@/lib/customers-actions";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import { formatDate, formatCurrency } from "@/lib/format";
import type { CustomerSummary, CustomerCard } from "@/lib/types";

const TIER_SUGGESTIONS = ["Silver", "Gold", "Platinum"];

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
  const showAllBranches = branchSelection === "all";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.plates.some((p) => p.toLowerCase().includes(q))
    );
  }, [customers, query]);

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
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name or plate…"
            className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 w-64"
          />
        </div>
        <button
          onClick={() => setCardModalFor("new")}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={15} /> New Membership Card
        </button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <th className="px-4 py-3">Customer</th>
              {showAllBranches && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Plates</th>
              <th className="px-4 py-3">Visits</th>
              <th className="px-4 py-3">Total Spend</th>
              <th className="px-4 py-3">Packages Bought</th>
              <th className="px-4 py-3">Membership Card</th>
              <th className="px-4 py-3">Last Visit</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={`${c.branch}-${c.name.toLowerCase()}`} className="border-t border-neutral-100">
                <td className="px-4 py-3 font-medium text-neutral-800">{c.name}</td>
                {showAllBranches && <td className="px-4 py-3 text-neutral-600">{branchLabel(c.branch)}</td>}
                <td className="px-4 py-3 text-neutral-600">{c.plates.join(", ") || "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{c.jobCount}</td>
                <td className="px-4 py-3 text-neutral-800 font-medium">{formatCurrency(c.totalSpend)}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {c.packagesBought.length > 0
                    ? c.packagesBought.map((p) => `${p.name} ×${p.count}`).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {c.card ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-fuchsia-700 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full px-2 py-0.5">
                      <CreditCard size={11} /> {c.card.tier || "Member"}
                      {c.card.expiryDate ? ` · exp ${formatDate(c.card.expiryDate)}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400">No card</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-500">{c.lastVisit ? formatDate(c.lastVisit) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setCardModalFor(c)}
                      className="text-neutral-400 hover:text-indigo-600 transition-colors p-1"
                      title={c.card ? "Edit membership card" : "Add membership card"}
                      aria-label={c.card ? "Edit membership card" : "Add membership card"}
                    >
                      <Pencil size={14} />
                    </button>
                    {c.card && (
                      <button
                        onClick={() => setDeleting(c.card)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                        title="Delete membership card"
                        aria-label="Delete membership card"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={showAllBranches ? 9 : 8} className="px-4 py-10 text-center text-neutral-500">
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

      {deleting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete this membership card?</h2>
            <p className="text-sm text-neutral-600 mb-6">
              <span className="text-neutral-800 font-medium">{deleting.customerName}</span>&apos;s membership card
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
  const [cardNumber, setCardNumber] = useState(existing?.cardNumber ?? "");
  const [tier, setTier] = useState(existing?.tier ?? "");
  const [issuedDate, setIssuedDate] = useState(existing?.issuedDate ?? new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(existing?.expiryDate ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameLocked = customer !== null;

  function handleSave() {
    const input = {
      branch: cardBranch,
      customerName,
      customerPhone,
      cardNumber,
      tier,
      issuedDate,
      expiryDate: expiryDate || null,
      notes,
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
            {existing ? "Edit Membership Card" : "New Membership Card"}
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
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
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
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60"
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Card No.</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Tier</label>
              <input
                type="text"
                list="tier-suggestions"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
              <datalist id="tier-suggestions">
                {TIER_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Issued</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Expiry</label>
              <input
                type="date"
                value={expiryDate ?? ""}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
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
            disabled={isPending || !customerName.trim()}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
