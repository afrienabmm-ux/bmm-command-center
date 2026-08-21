"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { registerCustomerCardAction } from "@/lib/customer-registration-actions";
import { BRANCHES, type Branch } from "@/lib/branch";

export default function JoinForm() {
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
