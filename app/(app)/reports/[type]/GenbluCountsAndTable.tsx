"use client";

import { useState } from "react";
import { Users, Image as ImageIcon, Smartphone, UserCog } from "lucide-react";
import ReportTable, { type ReportColumn } from "@/components/ReportTable";

export type GenbluCounts = { total: number; withScreenshot: number; bySalesman: number; byAdmin: number };

// Each card's own search term — matched against the row fields already
// searchable in the table below (uploadedByType/hasScreenshot), so
// clicking a card is really just "type this into the search box for me".
// "" (Total Registrations) clears the filter back to everything.
const CARD_FILTERS: Record<string, string> = {
  total: "",
  withScreenshot: "yes",
  bySalesman: "salesman",
  byAdmin: "admin",
};

// Same 4 stat boxes the report used to show as plain, unclickable divs —
// now buttons that filter the table below by clicking instead of typing.
// Bundled together with ReportTable (rather than living back in the server
// page) because they need to share state: which card is active has to
// drive the table's own search box.
export default function GenbluCountsAndTable({
  counts,
  columns,
  rows,
  dateField,
  searchFields,
  filename,
}: {
  counts: GenbluCounts;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  dateField?: string;
  searchFields: string[];
  filename: string;
}) {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  function toggle(card: string) {
    // Clicking the already-active card again turns the filter back off,
    // same as clicking "Total Registrations" — a single click is a plain
    // on/off toggle, not something that needs a separate "clear" step.
    setActiveCard((cur) => (cur === card ? null : card));
  }

  const cardBaseClass =
    "text-left bg-white border rounded-xl p-5 transition-colors focus:outline-none focus:ring-2 focus:ring-red-100";
  const cardClass = (card: string) =>
    `${cardBaseClass} ${activeCard === card ? "border-red-400 ring-2 ring-red-100" : "border-neutral-200 hover:border-red-200"}`;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 max-w-3xl">
        <button type="button" onClick={() => toggle("total")} className={cardClass("total")}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 text-pink-600 bg-pink-500/10">
            <Users size={17} />
          </div>
          <p className="text-2xl font-semibold text-neutral-900">{counts.total}</p>
          <p className="text-xs text-neutral-500 mt-1">Total Registrations</p>
        </button>
        <button type="button" onClick={() => toggle("withScreenshot")} className={cardClass("withScreenshot")}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 text-sky-600 bg-sky-500/10">
            <ImageIcon size={17} />
          </div>
          <p className="text-2xl font-semibold text-neutral-900">{counts.withScreenshot}</p>
          <p className="text-xs text-neutral-500 mt-1">With Screenshot Uploaded</p>
        </button>
        <button type="button" onClick={() => toggle("bySalesman")} className={cardClass("bySalesman")}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 text-violet-600 bg-violet-500/10">
            <Smartphone size={17} />
          </div>
          <p className="text-2xl font-semibold text-neutral-900">{counts.bySalesman}</p>
          <p className="text-xs text-neutral-500 mt-1">Uploaded By Salesman</p>
        </button>
        <button type="button" onClick={() => toggle("byAdmin")} className={cardClass("byAdmin")}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 text-amber-600 bg-amber-500/10">
            <UserCog size={17} />
          </div>
          <p className="text-2xl font-semibold text-neutral-900">{counts.byAdmin}</p>
          <p className="text-xs text-neutral-500 mt-1">Uploaded By Admin</p>
        </button>
      </div>
      <ReportTable
        columns={columns}
        rows={rows}
        dateField={dateField}
        searchFields={searchFields}
        searchPlaceholder="Search…"
        filename={filename}
        forcedQuery={activeCard === null ? undefined : CARD_FILTERS[activeCard]}
      />
    </div>
  );
}
