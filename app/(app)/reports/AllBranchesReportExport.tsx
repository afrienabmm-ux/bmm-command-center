"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { exportAllBranchesMechanicReportCsv } from "@/lib/export-actions";

export default function AllBranchesReportExport({ year, month }: { year: number; month: number }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportAllBranchesMechanicReportCsv(year, month);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bmm-mechanic-report-all-branches-${year}-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-800 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
    >
      <Download size={13} /> {exporting ? "Exporting…" : "Export All Branches (Excel/CSV)"}
    </button>
  );
}
