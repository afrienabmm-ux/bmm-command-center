"use client";

import { useEffect, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Day / Month / Year as three dropdowns instead of a calendar — for dates
// that are usually years back (a bike's sales date), where a calendar means
// clicking back month by month. On a phone each one opens as a scroll wheel.
// Value is "YYYY-MM-DD", or "" when not set.
export default function DropdownDate({
  value,
  onChange,
  fromYear = 2000,
}: {
  value: string;
  onChange: (value: string) => void;
  fromYear?: number;
}) {
  const parse = (v: string) => {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) } : { y: "", m: "", d: "" };
  };
  // Kept locally so a half-picked date (say, just the year) isn't lost.
  const [parts, setParts] = useState(() => parse(value));
  useEffect(() => {
    const p = parse(value);
    if (value) setParts(p);
  }, [value]);

  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = thisYear; y >= fromYear; y--) years.push(y);
  const daysInMonth = parts.y && parts.m ? new Date(Number(parts.y), Number(parts.m), 0).getDate() : 31;

  function update(next: { y: string; m: string; d: string }) {
    // A day past the end of the month (31 Feb) drops to the last day.
    if (next.y && next.m && next.d) {
      const max = new Date(Number(next.y), Number(next.m), 0).getDate();
      if (Number(next.d) > max) next = { ...next, d: String(max) };
    }
    setParts(next);
    if (next.y && next.m && next.d) onChange(`${next.y}-${next.m.padStart(2, "0")}-${next.d.padStart(2, "0")}`);
    else if (!next.y && !next.m && !next.d) onChange("");
  }

  const cls =
    "bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50";
  return (
    <div className="grid grid-cols-[1fr_1.2fr_1.3fr] gap-2">
      <select aria-label="Day" value={parts.d} onChange={(e) => update({ ...parts, d: e.target.value })} className={cls}>
        <option value="">Day</option>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d)}>
            {d}
          </option>
        ))}
      </select>
      <select aria-label="Month" value={parts.m} onChange={(e) => update({ ...parts, m: e.target.value })} className={cls}>
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label="Year" value={parts.y} onChange={(e) => update({ ...parts, y: e.target.value })} className={cls}>
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
