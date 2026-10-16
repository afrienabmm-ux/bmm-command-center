"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type MechanicTotal = {
  fullName: string;
  shortCode: string;
  walkInCount: number;
  walkInRevenue: number;
  packageRevenue: number;
  totalRevenue: number;
};

// Same idea as JobsheetRevenueSummary — a small table alongside the full
// month-by-month list, built entirely from the same rows already fetched
// for the report rather than a separate query. Opens on the current month;
// any of the last 12 months, or all 12 added up, can be picked instead.
export default function MechanicRevenueSummary({
  mechanics,
  months,
}: {
  mechanics: MechanicTotal[];
  months: { label: string; mechanics: MechanicTotal[] }[];
}) {
  // "all" = the 12 months added up; otherwise an index into `months`
  // (newest first, so 0 is the current month).
  const [period, setPeriod] = useState<"all" | number>(months.length > 0 ? 0 : "all");
  const rows = period === "all" ? mechanics : (months[period]?.mechanics ?? []);
  const heading = period === "all" ? "last 12 months" : months[period]?.label;
  const totals = rows.reduce(
    (t, m) => ({
      jobs: t.jobs + m.walkInCount,
      walkIn: t.walkIn + m.walkInRevenue,
      combo: t.combo + m.packageRevenue,
      total: t.total + m.totalRevenue,
    }),
    { jobs: 0, walkIn: 0, combo: 0, total: 0 }
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-sm font-medium text-neutral-800">Total Revenue by Mechanic ({heading})</p>
        <div className="relative">
          <select
            value={String(period)}
            onChange={(e) => setPeriod(e.target.value === "all" ? "all" : Number(e.target.value))}
            aria-label="Month"
            className="appearance-none bg-white border border-neutral-200 hover:border-red-300 rounded-lg pl-3 pr-8 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
          >
            {months.map((m, i) => (
              <option key={m.label} value={String(i)}>
                {m.label}
              </option>
            ))}
            <option value="all">Last 12 months</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto max-w-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <th className="px-4 py-2.5">Mechanic</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5 text-right">Jobsheets</th>
              <th className="px-4 py-2.5 text-right">Walk-in</th>
              <th className="px-4 py-2.5 text-right">Services Combo</th>
              <th className="px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-neutral-500">
                  No jobs in {heading}.
                </td>
              </tr>
            ) : (
              <>
                {rows.map((m) => (
                  <tr key={m.shortCode} className="border-t border-neutral-100">
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">{m.fullName}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">{m.shortCode}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-700">{m.walkInCount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-700">{formatCurrency(m.walkInRevenue)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-700">{formatCurrency(m.packageRevenue)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-900 font-medium">{formatCurrency(m.totalRevenue)}</td>
                  </tr>
                ))}
                <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold text-neutral-900">
                  <td className="px-4 py-2.5" colSpan={2}>
                    All mechanics
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{totals.jobs.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatCurrency(totals.walkIn)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatCurrency(totals.combo)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatCurrency(totals.total)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
