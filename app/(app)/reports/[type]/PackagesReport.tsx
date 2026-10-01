"use client";

import { useMemo, useState } from "react";
import ReportTable, { type ReportColumn } from "@/components/ReportTable";
import PackagesSoldSummary from "./PackagesSoldSummary";
import { comboTypeTotals, mechanicComboCounts, comboSummarySections } from "./combo-summary";

// Services Combo report: the summary tables are worked out from whatever the
// table is currently showing, so picking a Type, Branch or date range updates
// both the on-screen totals and what goes into the export.
export default function PackagesReport({
  columns,
  rows,
  dateField,
  searchFields,
  selectFilters,
  filename,
}: {
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  dateField?: string;
  searchFields: string[];
  selectFilters?: { field: string; label: string }[];
  filename: string;
}) {
  const [visible, setVisible] = useState(rows);
  const types = useMemo(() => comboTypeTotals(visible), [visible]);
  const mechanics = useMemo(() => mechanicComboCounts(visible), [visible]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="shrink-0 w-full lg:w-auto">
        <PackagesSoldSummary types={types} mechanics={mechanics} />
      </div>
      <div className="flex-1 min-w-0 w-full">
        <ReportTable
          columns={columns}
          rows={rows}
          dateField={dateField}
          searchFields={searchFields}
          searchPlaceholder="Search…"
          filename={filename}
          selectFilters={selectFilters}
          summarize={comboSummarySections}
          onFilteredChange={setVisible}
        />
      </div>
    </div>
  );
}
