"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { exportMechanicReportCsv } from "@/lib/export-actions";
import { formatCurrency, monthLabel } from "@/lib/format";
import type { BranchMonthSummary, MechanicAchievement, MechanicPackageAchievement } from "@/lib/reports-actions";
import type { Branch } from "@/lib/branch";

export default function ReportsClient({
  summary,
  achievements,
  packageAchievements,
  branch,
}: {
  summary: BranchMonthSummary;
  achievements: MechanicAchievement[];
  packageAchievements: MechanicPackageAchievement[];
  branch: Branch;
}) {
  const [exporting, setExporting] = useState(false);

  const prevMonth = summary.month === 1 ? 12 : summary.month - 1;
  const prevYear = summary.month === 1 ? summary.year - 1 : summary.year;
  const nextMonth = summary.month === 12 ? 1 : summary.month + 1;
  const nextYear = summary.month === 12 ? summary.year + 1 : summary.year;
  const pct =
    summary.targetAmount > 0 ? Math.min(100, Math.round((summary.achievedAmount / summary.targetAmount) * 100)) : 0;

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportMechanicReportCsv(branch, summary.year, summary.month);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bmm-mechanic-report-${branch}-${summary.year}-${summary.month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm text-neutral-700">
          <Link href={`/reports?year=${prevYear}&month=${prevMonth}`} className="text-neutral-500 hover:text-neutral-800">
            <ChevronLeft size={16} />
          </Link>
          <span className="font-medium">{monthLabel(summary.month, summary.year)}</span>
          <Link href={`/reports?year=${nextYear}&month=${nextMonth}`} className="text-neutral-500 hover:text-neutral-800">
            <ChevronRight size={16} />
          </Link>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-800 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Download size={13} /> {exporting ? "Exporting…" : "Export Mechanic Report"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500 mb-1">Target</p>
          <p className="text-xl font-semibold text-neutral-900">{formatCurrency(summary.targetAmount)}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500 mb-1">Achieved</p>
          <p className="text-xl font-semibold text-neutral-900">{formatCurrency(summary.achievedAmount)}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500 mb-1">Progress</p>
          <p className="text-xl font-semibold text-neutral-900">{pct}%</p>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200">
          <p className="text-sm font-medium text-neutral-800">Individual Mechanic Achievement</p>
          <p className="text-xs text-neutral-500 mt-0.5">Restore Bike vs Walk-in, completed jobs this month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Restore Bike</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Walk-in</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {achievements.map((a) => (
                <tr key={a.mechanicId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
                    {a.fullName} <span className="text-neutral-500 font-normal">({a.shortCode})</span>
                  </td>
                  <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
                    {a.restoreBikeCount} jobs · {formatCurrency(a.restoreBikeRevenue)}
                  </td>
                  <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">
                    {a.walkInCount} jobs · {formatCurrency(a.walkInRevenue)}
                  </td>
                  <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
                    {formatCurrency(a.totalRevenue)}
                  </td>
                </tr>
              ))}
              {achievements.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    No mechanics on this branch yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200">
          <p className="text-sm font-medium text-neutral-800">Package Sales Achievement</p>
          <p className="text-xs text-neutral-500 mt-0.5">Main package sets sold this month, by mechanic</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Sets Sold</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {packageAchievements.map((a) => (
                <tr key={a.mechanicId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
                    {a.fullName} <span className="text-neutral-500 font-normal">({a.shortCode})</span>
                  </td>
                  <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{a.setsSold} set{a.setsSold === 1 ? "" : "s"}</td>
                  <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">{formatCurrency(a.revenue)}</td>
                </tr>
              ))}
              {packageAchievements.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    No mechanics on this branch yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
