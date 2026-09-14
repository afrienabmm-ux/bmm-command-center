"use client";

import { Download } from "lucide-react";
import { toCsv } from "@/lib/format";
import { logClientActivityAction } from "@/lib/activity-log";
import type { GenbluReportMetric, GenbluReportPayload } from "@/lib/genblu-report-actions";

const HEADERS = ["Bikes Sold", "GenBlu Installed", "Install %", "E-Coupon Used", "E-Coupon %"];

function metricRow(row: GenbluReportMetric): (string | number)[] {
  return [row.bikes_sold ?? "", row.genblu_installed ?? "", row.install_pct ?? "", row.ecoupon_used ?? "", row.ecoupon_pct ?? ""];
}

export default function GenbluRateExportButton({ monthKey, report }: { monthKey: string; report: GenbluReportPayload }) {
  function handleExport() {
    const sections: string[] = [];

    if (report.total) {
      sections.push("All Branches", toCsv(HEADERS, [metricRow(report.total)]), "");
    }
    if (report.branches?.length) {
      sections.push(
        "By Branch",
        toCsv(["Branch", ...HEADERS], report.branches.map((b) => [b.branch ?? b.name ?? "", ...metricRow(b)])),
        ""
      );
    }
    if (report.salespeople?.length) {
      sections.push(
        "By Salesperson",
        toCsv(["Salesperson", "Branch", ...HEADERS], report.salespeople.map((p) => [p.name ?? "", p.branch ?? "", ...metricRow(p)])),
        ""
      );
    }

    const csv = sections.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GenBlu Registration Rate - ${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logClientActivityAction("Exported report", `GenBlu Registration Rate (${monthKey})`);
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
    >
      <Download size={15} /> Export
    </button>
  );
}
