"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, User, Phone, Building2, Sparkles, Wrench, Bike, ChevronDown } from "lucide-react";
import {
  registerCustomerCardAction,
  lookupCustomerCardAction,
  type MembershipLookup,
} from "@/lib/customer-registration-actions";
import { BRANCHES, type Branch } from "@/lib/branch";
import { formatCurrency, formatDate } from "@/lib/format";
import { stampCardSize, rewardForStamp, nextReward } from "@/lib/membership";

// How long a "check my card" / "just registered" screen survives a page
// refresh before the customer has to type their phone number again.
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;
const JOIN_STORAGE_KEY = "bmm_join_session";
const LOOKUP_STORAGE_KEY = "bmm_lookup_session";

type StoredJoin = { name: string; cardNumber: string; stamps: number[]; plateNo: string; savedAt: number };
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
  cardNumber,
  name,
  plateNo,
  memberSince,
}: {
  cardNumber: string;
  name: string;
  plateNo?: string;
  memberSince?: string;
}) {
  return (
    <div className="relative w-full aspect-[1.6/1] rounded-2xl bg-gradient-to-br from-red-500 via-red-700 to-neutral-900 p-5 text-white shadow-xl overflow-hidden">
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
      <div className="absolute -right-1 bottom-1 w-20 h-20 bg-white/10 rounded-full" />
      <div className="flex items-center justify-between relative z-10">
        <p className="text-[10px] font-semibold tracking-widest uppercase opacity-80">BMM Services Card</p>
        <Sparkles size={16} className="opacity-90" />
      </div>
      <p className="text-[10px] uppercase tracking-widest opacity-70 mt-7">Member</p>
      <p className="text-xl font-bold tracking-widest mt-1">{cardNumber}</p>
      <div className="flex items-end justify-between mt-4 relative z-10">
        <div className="min-w-0">
          <p className="text-xs opacity-90 truncate uppercase tracking-wide">{name}</p>
          {plateNo && <p className="text-[10px] opacity-70 truncate uppercase tracking-wide mt-0.5">{plateNo}</p>}
        </div>
        {memberSince && <p className="text-[10px] opacity-70 shrink-0 ml-2">Since {memberSince}</p>}
      </div>
    </div>
  );
}

// Mirrors the physical Yamaha Cares punch card exactly — specific rewards
// at stamps 1/4/7/10. Ticked entirely by admin from the Services Card page,
// not derived from visit count.
function StampProgress({ stamps }: { stamps: number[] }) {
  const size = stampCardSize();
  const count = stamps.length;
  const upcoming = nextReward(count);
  const justEarned = rewardForStamp(count);
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">Your Stamp Card</p>
        <p className="text-xs font-bold text-red-600">
          {count}/{size}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {Array.from({ length: size }).map((_, i) => {
          const stampNo = i + 1;
          const reward = rewardForStamp(stampNo);
          const filled = stamps.includes(stampNo);
          return (
            <div key={i} className="flex flex-col items-center gap-1 w-[18%]">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  filled
                    ? "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-sm"
                    : reward
                      ? "bg-red-50 text-red-300 border-2 border-dashed border-red-200"
                      : "bg-neutral-100 text-neutral-300 border border-neutral-200"
                }`}
              >
                {filled ? <Wrench size={14} /> : <span className="text-[10px] font-semibold">{stampNo}</span>}
              </div>
              {reward && <p className="text-[8px] text-neutral-500 text-center leading-tight">{reward}</p>}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-neutral-400 mt-3 text-center">
        {justEarned
          ? `🎉 You've earned: ${justEarned} — redeem it at the counter!`
          : upcoming
            ? `Next reward: ${upcoming.label} at stamp ${upcoming.stamp}.`
            : "Card complete — a new one starts on your next visit."}
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
  const [branch, setBranch] = useState<Branch>("kapar");
  const [name, setName] = useState(restored?.name ?? "");
  const [phone, setPhone] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [model, setModel] = useState("");
  const [boughtBikeHere, setBoughtBikeHere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cardNumber: string; stamps: number[]; plateNo: string } | null>(
    restored ? { cardNumber: restored.cardNumber, stamps: restored.stamps, plateNo: restored.plateNo } : null
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (restored) {
      setName(restored.name);
      setResult({ cardNumber: restored.cardNumber, stamps: restored.stamps, plateNo: restored.plateNo });
    }
  }, [restored]);

  function handleRegister() {
    setError(null);
    startTransition(async () => {
      const res = await registerCustomerCardAction({
        branch,
        customerName: name,
        customerPhone: phone,
        plateNo,
        model,
        boughtBikeHere,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
      writeSession(JOIN_STORAGE_KEY, { name: name.trim(), cardNumber: res.cardNumber, stamps: res.stamps, plateNo: res.plateNo });
    });
  }

  if (result) {
    return (
      <div className="py-2">
        <p className="text-sm text-neutral-600 text-center mb-4">
          Hi <span className="font-semibold text-neutral-900">{name.trim()}</span>! You&apos;re in.
        </p>
        <TierCard cardNumber={result.cardNumber} name={name} plateNo={result.plateNo} />
        <StampProgress stamps={result.stamps} />
        <p className="text-xs text-neutral-400 text-center mt-4">Show this screen at the counter</p>
        <button
          onClick={() => {
            localStorage.removeItem(JOIN_STORAGE_KEY);
            onClear();
            setResult(null);
            setName("");
          }}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mt-4 w-full text-center"
        >
          Not you? Start over
        </button>
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
          className="w-full appearance-none bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-xl pl-10 pr-9 py-3 text-sm text-neutral-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
        >
          {BRANCHES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
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
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <Bike size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={plateNo}
            onChange={(e) => setPlateNo(e.target.value)}
            placeholder="Plate No."
            className={inputClass}
          />
        </div>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model (optional)"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-3 text-sm text-neutral-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-colors"
        />
      </div>
      <label className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
        <input
          type="checkbox"
          checked={boughtBikeHere}
          onChange={(e) => setBoughtBikeHere(e.target.checked)}
          className="accent-red-500 mt-0.5"
        />
        <span className="text-xs text-neutral-700">
          I bought my bike from Berjaya Mega Motors — this services card is only for bike-buyers.
        </span>
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        onClick={handleRegister}
        disabled={isPending || !name.trim() || !phone.trim() || !plateNo.trim() || !boughtBikeHere}
        className={primaryButtonClass}
      >
        {isPending ? "Getting your card…" : "Get My Services Card"}
      </button>
    </div>
  );
}

function LookupTab({ restored, onClear }: { restored: StoredLookup | null; onClear: () => void }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MembershipLookup | null>(restored?.result ?? null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (restored) setResult(restored.result);
  }, [restored]);

  function handleLookup() {
    setError(null);
    startTransition(async () => {
      const res = await lookupCustomerCardAction(phone);
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
  }

  if (result) {
    return (
      <div className="py-2">
        <p className="text-sm text-neutral-600 text-center mb-4">
          Hi <span className="font-semibold text-neutral-900">{result.customerName.trim()}</span>!
        </p>
        <TierCard
          cardNumber={result.cardNumber}
          name={result.customerName}
          plateNo={result.plateNo}
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
        <StampProgress stamps={result.stamps} />
        <button onClick={handleReset} className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mt-4 w-full text-center">
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
          type="text"
          autoCapitalize="characters"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone Number / Plate No."
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button onClick={handleLookup} disabled={isPending || !phone.trim()} className={primaryButtonClass}>
        <Search size={14} /> {isPending ? "Looking up…" : "Find My Card"}
      </button>
    </div>
  );
}
