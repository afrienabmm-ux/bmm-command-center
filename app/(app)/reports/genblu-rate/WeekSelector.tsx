"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";

export default function WeekSelector({
  weeks,
  selectedWeek,
}: {
  weeks: { week: number; label: string }[];
  selectedWeek: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "month") {
      params.delete("week");
    } else {
      params.set("week", value);
    }
    startTransition(() => {
      router.push(`/reports/genblu-rate?${params.toString()}`);
    });
  }

  if (weeks.length === 0) return null;

  return (
    <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-2 py-1.5">
      <CalendarDays size={14} className="text-neutral-500 shrink-0 ml-1" />
      <select
        value={selectedWeek ?? "month"}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-neutral-800 focus:outline-none disabled:opacity-50"
      >
        <option value="month">Whole Month</option>
        {weeks.map((w) => (
          <option key={w.week} value={w.week}>
            {w.label}
          </option>
        ))}
      </select>
    </div>
  );
}
