"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Picks a single day within the month already chosen by MonthPicker — lets
// the GM review any past day's pace (Revenue Today / Today's Status /
// streak on the Mechanic Performance table) instead of only ever seeing
// today's numbers. Scoped to this page only; MonthPicker itself stays
// month/year-only everywhere else it's used.
export default function DaySelect({ year, month, day }: { year: number; month: number; day: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const now = new Date();
  const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate();

  function go(nextDay: number) {
    startTransition(() => {
      router.push(`/sales-performance?year=${year}&month=${month}&day=${nextDay}`);
    });
  }

  return (
    <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-lg px-2 py-1.5">
      <select
        value={day}
        disabled={isPending}
        onChange={(e) => go(Number(e.target.value))}
        className="bg-transparent text-sm text-neutral-800 focus:outline-none disabled:opacity-50"
      >
        {days.map((d) => (
          <option key={d} value={d}>
            Day {d}
          </option>
        ))}
      </select>
      {!isToday && (
        <button
          onClick={() => go(now.getDate())}
          disabled={isPending}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 whitespace-nowrap"
        >
          Today
        </button>
      )}
    </div>
  );
}
