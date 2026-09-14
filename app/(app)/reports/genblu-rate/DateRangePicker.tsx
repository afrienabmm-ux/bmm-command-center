"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar } from "lucide-react";

// Picking "From ... To ..." shows whichever report the Sales Dashboard's
// most recent delivery in that window looked like — not a delta between
// two points, just "as of the end of that range". Good enough to pick out
// one particular week's snapshot instead of always seeing the latest.
export default function DateRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    startTransition(() => {
      router.push(`/reports/genblu-rate?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-1.5">
      <Calendar size={14} className="text-neutral-500 shrink-0" />
      <input
        type="date"
        value={localFrom}
        disabled={isPending}
        onChange={(e) => setLocalFrom(e.target.value)}
        onBlur={() => localFrom !== from && apply(localFrom, localTo)}
        className="bg-transparent text-sm text-neutral-800 focus:outline-none disabled:opacity-50"
      />
      <span className="text-sm text-neutral-400">to</span>
      <input
        type="date"
        value={localTo}
        disabled={isPending}
        onChange={(e) => setLocalTo(e.target.value)}
        onBlur={() => localTo !== to && apply(localFrom, localTo)}
        className="bg-transparent text-sm text-neutral-800 focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
