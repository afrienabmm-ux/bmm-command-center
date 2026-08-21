"use client";

import { useState, useTransition } from "react";
import { CreditCard, Search } from "lucide-react";
import { registerCustomerCardAction, lookupMembershipAction, type MembershipLookup } from "@/lib/customer-registration-actions";
import { BRANCHES, type Branch } from "@/lib/branch";
import { formatCurrency, formatDate } from "@/lib/format";

export default function JoinForm() {
  const [mode, setMode] = useState<"join" | "lookup">("join");

  return (
    <div>
      <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 mb-5">
        <button
          onClick={() => setMode("join")}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            mode === "join" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
          }`}
        >
          New Member
        </button>
        <button
          onClick={() => setMode("lookup")}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            mode === "lookup" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
          }`}
        >
          Check My Card
        </button>
      </div>
      {mode === "join" ? <JoinTab /> : <LookupTab />}
    </div>
  );
}

function JoinTab() {
  const [branch, setBranch] = useState<Branch>("kapar");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cardNumber: string; tier: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await registerCustomerCardAction({ branch, customerName: name, customerPhone: phone });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
    });
  }

  if (result) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
          <CreditCard size={24} className="text-indigo-600" />
        </div>
        <p className="text-sm text-neutral-600 mb-1">You&apos;re in, {name.trim().split(" ")[0]}!</p>
        <p className="text-lg font-semibold text-neutral-900 tracking-wide mb-1">{result.cardNumber}</p>
        <p className="text-xs text-neutral-500">{result.tier} tier · Show this screen at the counter</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value as Branch)}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
        >
          {BRANCHES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Full Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone Number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 012-3456789"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending || !name.trim() || !phone.trim()}
        className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        {isPending ? "Joining…" : "Get My Card"}
      </button>
    </div>
  );
}

function LookupTab() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MembershipLookup | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await lookupMembershipAction(phone);
      if ("error" in res) {
        setError(res.error);
        setResult(null);
        return;
      }
      setResult(res);
    });
  }

  if (result) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
          <CreditCard size={24} className="text-indigo-600" />
        </div>
        <p className="text-sm text-neutral-600 mb-1">Hi {result.customerName.trim().split(" ")[0]}!</p>
        <p className="text-lg font-semibold text-neutral-900 tracking-wide mb-1">{result.cardNumber}</p>
        <p className="text-xs text-neutral-500 mb-4">
          {result.tier} tier · Member since {formatDate(result.issuedDate)}
          {result.expiryDate ? ` · Expires ${formatDate(result.expiryDate)}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg py-3">
            <p className="text-lg font-semibold text-neutral-900">{result.visitCount}</p>
            <p className="text-[11px] text-neutral-500">Visits</p>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg py-3">
            <p className="text-lg font-semibold text-neutral-900">{formatCurrency(result.totalSpend)}</p>
            <p className="text-[11px] text-neutral-500">Total Spend</p>
          </div>
        </div>
        <button
          onClick={() => setResult(null)}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mt-4"
        >
          Check another number
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone Number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="The number you signed up with"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending || !phone.trim()}
        className="w-full flex items-center justify-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        <Search size={14} /> {isPending ? "Looking up…" : "Find My Card"}
      </button>
    </div>
  );
}
