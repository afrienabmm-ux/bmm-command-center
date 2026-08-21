"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, User, Phone, Mail, Building2, Sparkles, KeyRound, Wrench } from "lucide-react";
import {
  registerCustomerCardAction,
  sendRegistrationOtpAction,
  verifyRegistrationOtpAction,
  requestLookupOtpAction,
  verifyLookupOtpAction,
  type MembershipLookup,
} from "@/lib/customer-registration-actions";
import { BRANCHES, type Branch } from "@/lib/branch";
import { formatCurrency, formatDate } from "@/lib/format";
import { stampsOnCurrentCard, stampCardSize, hasFreeServiceReady } from "@/lib/membership";

const TIER_GRADIENTS: Record<string, string> = {
  Bronze: "from-orange-400 via-amber-600 to-orange-800",
  Silver: "from-slate-300 via-slate-400 to-slate-600",
  Gold: "from-yellow-300 via-yellow-500 to-amber-600",
  Platinum: "from-indigo-300 via-violet-500 to-purple-700",
};

// How long a "check my card" / "just registered" screen survives a page
// refresh before the customer has to type their phone number again.
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;
const JOIN_STORAGE_KEY = "bmm_join_session";
const LOOKUP_STORAGE_KEY = "bmm_lookup_session";

type StoredJoin = { name: string; cardNumber: string; tier: string; visitCount: number; savedAt: number };
type StoredLookup = { result: MembershipLookup; savedAt: number };

function readSession<T extends { savedAt: number }>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(key: string, data: object) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // Private browsing / storage disabled — the customer just re-enters
    // their number next time, no need to block on it.
  }
}

function TierCard({
  tier,
  cardNumber,
  name,
  memberSince,
}: {
  tier: string;
  cardNumber: string;
  name: string;
  memberSince?: string;
}) {
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
      <div className="flex items-end justify-between mt-4 relative z-10">
        <p className="text-xs opacity-90 truncate uppercase tracking-wide">{name}</p>
        {memberSince && <p className="text-[10px] opacity-70 shrink-0 ml-2">Since {memberSince}</p>}
      </div>
    </div>
  );
}

function StampProgress({ visitCount }: { visitCount: number }) {
  const stamps = stampsOnCurrentCard(visitCount);
  const size = stampCardSize();
  const ready = hasFreeServiceReady(visitCount);
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">Progress to Your Free Service</p>
        <p className="text-xs font-bold text-red-600">
          {stamps}/{size}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {Array.from({ length: size }).map((_, i) => (
          <div
            key={i}
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              i < stamps
                ? "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-300 border border-neutral-200"
            }`}
          >
            <Wrench size={13} />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-neutral-400 mt-3 text-center">
        {ready
          ? "🎉 You've earned a FREE service — redeem it at the counter!"
          : `Complete ${size} services and get 1 FREE service.`}
      </p>
    </div>
  );
}

const inputClass =
  "w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-neutral-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-colors";

const primaryButtonClass =
  "w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]";

export default function JoinForm() {
  const [mode, setMode] = useState<"join" | "lookup">("join");
  const [restoredJoin, setRestoredJoin] = useState<StoredJoin | null>(null);
  const [restoredLookup, setRestoredLookup] = useState<StoredLookup | null>(null);

  // On load, whichever session (join or lookup) is still within its
  // 3-hour window wins and the page opens straight to that result — the
  // customer only re-types their number once it's actually expired.
  useEffect(() => {
    const join = readSession<StoredJoin>(JOIN_STORAGE_KEY);
    const lookup = readSession<StoredLookup>(LOOKUP_STORAGE_KEY);
    if (lookup && (!join || lookup.savedAt >= join.savedAt)) {
      setRestoredLookup(lookup);
      setMode("lookup");
    } else if (join) {
      setRestoredJoin(join);
      setMode("join");
    }
  }, []);

  return (
    <div>
      <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1 mb-5">
        <button
          onClick={() => setMode("join")}
          className={`flex-1 text-xs font-semibold py-2 rounded-full transition-all ${
            mode === "join" ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm" : "text-neutral-500"
          }`}
        >
          New Member
        </button>
        <button
          onClick={() => setMode("lookup")}
          className={`flex-1 text-xs font-semibold py-2 rounded-full transition-all ${
            mode === "lookup" ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm" : "text-neutral-500"
          }`}
        >
          Check My Card
        </button>
      </div>
      {mode === "join" ? (
        <JoinTab restored={restoredJoin} onClear={() => setRestoredJoin(null)} />
      ) : (
        <LookupTab restored={restoredLookup} onClear={() => setRestoredLookup(null)} />
      )}
    </div>
  );
}

function JoinTab({ restored, onClear }: { restored: StoredJoin | null; onClear: () => void }) {
  const [step, setStep] = useState<"form" | "otp">("form");
  const [branch, setBranch] = useState<Branch>("kapar");
  const [name, setName] = useState(restored?.name ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cardNumber: string; tier: string; visitCount: number } | null>(
    restored ? { cardNumber: restored.cardNumber, tier: restored.tier, visitCount: restored.visitCount } : null
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (restored) {
      setName(restored.name);
      setResult({ cardNumber: restored.cardNumber, tier: restored.tier, visitCount: restored.visitCount });
    }
  }, [restored]);

  function handleSendCode() {
    setError(null);
    startTransition(async () => {
      const res = await sendRegistrationOtpAction(email);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setStep("otp");
    });
  }

  function handleVerifyAndRegister() {
    setError(null);
    startTransition(async () => {
      const verifyRes = await verifyRegistrationOtpAction(email, code);
      if ("error" in verifyRes) {
        setError(verifyRes.error);
        return;
      }
      const res = await registerCustomerCardAction({ branch, customerName: name, customerPhone: phone, customerEmail: email });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
      writeSession(JOIN_STORAGE_KEY, { name: name.trim(), cardNumber: res.cardNumber, tier: res.tier, visitCount: res.visitCount });
    });
  }

  if (result) {
    return (
      <div className="py-2">
        <p className="text-sm text-neutral-600 text-center mb-4">
          Hi <span className="font-semibold text-neutral-900">{name.trim()}</span>! You&apos;re in.
        </p>
        <TierCard tier={result.tier} cardNumber={result.cardNumber} name={name} />
        <StampProgress visitCount={result.visitCount} />
        <p className="text-xs text-neutral-400 text-center mt-4">Show this screen at the counter</p>
        <button
          onClick={() => {
            localStorage.removeItem(JOIN_STORAGE_KEY);
            onClear();
            setResult(null);
            setName("");
            setStep("form");
          }}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mt-4 w-full text-center"
        >
          Not you? Start over
        </button>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-3.5">
        <p className="text-xs text-neutral-500">
          We sent a 6-digit code to <span className="font-medium text-neutral-800">{email}</span>. Enter it below.
        </p>
        <div className="relative">
          <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={inputClass}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button onClick={handleVerifyAndRegister} disabled={isPending || !code.trim()} className={primaryButtonClass}>
          {isPending ? "Verifying…" : "Verify & Get Card"}
        </button>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <button type="button" onClick={() => setStep("form")} className="hover:text-neutral-700">
            Change details
          </button>
          <button type="button" onClick={handleSendCode} disabled={isPending} className="hover:text-neutral-700">
            Resend code
          </button>
        </div>
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
      <div className="relative">
        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        onClick={handleSendCode}
        disabled={isPending || !name.trim() || !phone.trim() || !email.trim()}
        className={primaryButtonClass}
      >
        {isPending ? "Sending…" : "Send Verification Code"}
      </button>
    </div>
  );
}

function LookupTab({ restored, onClear }: { restored: StoredLookup | null; onClear: () => void }) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MembershipLookup | null>(restored?.result ?? null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (restored) setResult(restored.result);
  }, [restored]);

  function handleRequestCode() {
    setError(null);
    startTransition(async () => {
      const res = await requestLookupOtpAction(phone);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      if (!res.needsOtp) {
        // No email on file for this card (older/staff-added card) — show
        // the lookup straight away, same as before this feature existed.
        setResult(res.result);
        writeSession(LOOKUP_STORAGE_KEY, { result: res.result });
        return;
      }
      setEmailHint(res.emailHint);
      setStep("otp");
    });
  }

  function handleVerifyCode() {
    setError(null);
    startTransition(async () => {
      const res = await verifyLookupOtpAction(phone, code);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
      writeSession(LOOKUP_STORAGE_KEY, { result: res });
    });
  }

  function handleReset() {
    localStorage.removeItem(LOOKUP_STORAGE_KEY);
    onClear();
    setResult(null);
    setPhone("");
    setCode("");
    setStep("phone");
  }

  if (result) {
    return (
      <div className="py-2">
        <p className="text-sm text-neutral-600 text-center mb-4">
          Hi <span className="font-semibold text-neutral-900">{result.customerName.trim()}</span>!
        </p>
        <TierCard
          tier={result.tier}
          cardNumber={result.cardNumber}
          name={result.customerName}
          memberSince={formatDate(result.issuedDate)}
        />
        {result.expiryDate && (
          <p className="text-[11px] text-neutral-400 text-center mt-2">Expires {formatDate(result.expiryDate)}</p>
        )}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-xl py-3 text-center">
            <p className="text-lg font-bold text-neutral-900">{result.visitCount}</p>
            <p className="text-[11px] text-neutral-500">Visits</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-xl py-3 text-center">
            <p className="text-lg font-bold text-neutral-900">{formatCurrency(result.totalSpend)}</p>
            <p className="text-[11px] text-neutral-500">Total Spend</p>
          </div>
        </div>
        <StampProgress visitCount={result.visitCount} />
        <button onClick={handleReset} className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mt-4 w-full text-center">
          Check another number
        </button>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-3.5">
        <p className="text-xs text-neutral-500">
          For your privacy, we sent a 6-digit code to <span className="font-medium text-neutral-800">{emailHint}</span> — the
          email on file for this card.
        </p>
        <div className="relative">
          <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={inputClass}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button onClick={handleVerifyCode} disabled={isPending || !code.trim()} className={primaryButtonClass}>
          {isPending ? "Verifying…" : "Verify & Show Card"}
        </button>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <button type="button" onClick={() => setStep("phone")} className="hover:text-neutral-700">
            Change number
          </button>
          <button type="button" onClick={handleRequestCode} disabled={isPending} className="hover:text-neutral-700">
            Resend code
          </button>
        </div>
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

      <button onClick={handleRequestCode} disabled={isPending || !phone.trim()} className={primaryButtonClass}>
        <Search size={14} /> {isPending ? "Looking up…" : "Find My Card"}
      </button>
    </div>
  );
}
