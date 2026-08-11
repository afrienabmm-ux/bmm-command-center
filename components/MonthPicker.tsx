"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Calendar } from "lucide-react";
import { MONTH_NAMES } from "@/lib/format";

export default function MonthPicker({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i);

  function go(nextYear: number, nextMonth: number) {
    startTransition(() => {
      router.push(`/?year=${nextYear}&month=${nextMonth}`);
    });
  }

  function shift(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    go(d.getFullYear(), d.getMonth() + 1);
  }

  return (
    <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-2 py-1.5">
      <Calendar size={14} className="text-neutral-500 shrink-0 ml-1" />
      <button
        onClick={() => shift(-1)}
        disabled={isPending}
        className="px-1.5 text-neutral-500 hover:text-neutral-800 disabled:opacity-50 transition-colors"
        aria-label="Previous month"
      >
        ‹
      </button>
      <select
        value={month}
        disabled={isPending}
        onChange={(e) => go(year, Number(e.target.value))}
        className="bg-transparent text-sm text-neutral-800 focus:outline-none disabled:opacity-50"
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={year}
        disabled={isPending}
        onChange={(e) => go(Number(e.target.value), month)}
        className="bg-transparent text-sm text-neutral-800 focus:outline-none disabled:opacity-50"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <button
        onClick={() => shift(1)}
        disabled={isPending}
        className="px-1.5 text-neutral-500 hover:text-neutral-800 disabled:opacity-50 transition-colors"
        aria-label="Next month"
      >
        ›
      </button>
      {!isCurrentMonth && (
        <button
          onClick={() => go(now.getFullYear(), now.getMonth() + 1)}
          disabled={isPending}
          className="ml-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 whitespace-nowrap"
        >
          Today
        </button>
      )}
    </div>
  );
}
