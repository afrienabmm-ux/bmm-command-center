"use client";

import { useState, useTransition } from "react";
import { Search, User, Phone, Building2, Sparkles } from "lucide-react";
import { registerCustomerCardAction, lookupMembershipAction, type MembershipLookup } from "@/lib/customer-registration-actions";
import { BRANCHES, type Branch } from "@/lib/branch";
import { formatCurrency, formatDate } from "@/lib/format";

const TIER_GRADIENTS: Record<string, string> = {
  Bronze: "from-orange-400 via-amber-600 to-orange-800",
  Silver: "from-slate-300 via-slate-400 to-slate-600",
  Gold: "from-yellow-300 via-yellow-500 to-amber-600",
  Platinum: "from-indigo-300 via-violet-500 to-purple-700",
};

function TierCard({ tier, cardNumber, name }: { tier: string; cardNumber: string; name: string }) {
  const gradient = TIER_GRADIENTS[tier] ?? TIER_GRADIENTS.Bronze;
  return (
    <div className={`relative w-full aspect-[1.6/1] rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-xl overflow-hidden`}>
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
      <div className="absolute -right-1 bottom-1 w-20 h-20 bg-white/10 rounded-full" />
      <div className="flex items-center justify-between relative z-10">
        <p className="text-[10px] font-semibold tracking-widest uppercase opacity-80">BMM Membership</p>
        <Sparkles size={16} className="opacity-90" />
      </div>
      <p className="text-[10px] uppercase tracking-widest opacity-70 mt-7">{tier} Member</p>
      <p className="text-xl font-bold tracking-widest mt-1">{cardNumber}</p>
      <p className="text-xs mt-4 opacity-90 truncate uppercase tracking-wide">{name}</p>
    </div>
  );
}

const inputClass =
  "w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-neutral-800 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 transition-colors";

const primaryButtonClass =
  "w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-3 rounded-xl transition-all shadow-lg shadow-fuchsia-500/20 active:scale-[0.98]";

export default function JoinForm() {
  const [mode, setMode] = useState<"join" | "lookup">("join");

  return (
    <div>
      <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1 mb-5">
        <button
          onClick={() => setMode("join")}
          className={`flex-1 text-xs font-semibold py-2 rounded-full transition-all ${
            mode === "join" ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-sm" : "text-neutral-500"
          }`}
        >
          New Member
        </button>
        <button
          onClick={() => setMode("lookup")}
          className={`flex-1 text-xs font-semibold py-2 rounded-full transition-all ${
            mode === "lookup" ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-sm" : "text-neutral-500"
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
      <div className="py-2">
        <p className="text-sm text-neutral-600 text-center mb-4">
          Hi <span className="font-semibold text-neutral-900">{name.trim()}</span>! You&apos;re in.
        </p>
        <TierCard tier={result.tier} cardNumber={result.cardNumber} name={name} />
        <p className="text-xs text-neutral-400 text-center mt-4">Show this screen at the counter</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="relative">
        <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value as Branch)}
          className={`${inputClass} appearance-none`}
        >
          {BRANCHES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div className="relative">
        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          className={inputClass}
        />
      </div>
      <div className="relative">
        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 012-3456789"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button onClick={handleSubmit} disabled={isPending || !name.trim() || !phone.trim()} className={primaryButtonClass}>
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
      <div className="py-2">
        <p className="text-sm text-neutral-600 text-center mb-4">
          Hi <span className="font-semibold text-neutral-900">{result.customerName.trim()}</span>!
        </p>
        <TierCard tier={result.tier} cardNumber={result.cardNumber} name={result.customerName} />
        <p className="text-xs text-neutral-400 text-center mt-3">
          Member since {formatDate(result.issuedDate)}
          {result.expiryDate ? ` · Expires ${formatDate(result.expiryDate)}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-gradient-to-br from-indigo-50 to-fuchsia-50 border border-indigo-100 rounded-xl py-3">
            <p className="text-lg font-bold text-neutral-900">{result.visitCount}</p>
            <p className="text-[11px] text-neutral-500">Visits</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-fuchsia-50 border border-indigo-100 rounded-xl py-3">
            <p className="text-lg font-bold text-neutral-900">{formatCurrency(result.totalSpend)}</p>
            <p className="text-[11px] text-neutral-500">Total Spend</p>
          </div>
        </div>
        <button
          onClick={() => setResult(null)}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mt-4 w-full text-center"
        >
          Check another number
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="relative">
        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="The number you signed up with"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button onClick={handleSubmit} disabled={isPending || !phone.trim()} className={primaryButtonClass}>
        <Search size={14} /> {isPending ? "Looking up…" : "Find My Card"}
      </button>
    </div>
  );
}
