"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Search, X } from "lucide-react";
import { toCsv } from "@/lib/format";
import { logClientActivityAction } from "@/lib/activity-log";
import ModalPortal from "@/components/ModalPortal";

export type ReportColumn = { key: string; label: string };

// One generic filterable-table-plus-export view, reused by every report
// under /reports/[type] instead of building the same search/date-range/CSV
// UI seven separate times. Rows are already fully shaped by the server
// page (real column values, not raw DB rows), so this component only ever
// deals with plain strings/numbers — no report-specific logic lives here.
export default function ReportTable({
  columns,
  rows,
  dateField,
  monthField,
  searchFields,
  searchPlaceholder = "Search…",
  filename,
  imageField,
  summarySections,
  selectFilters,
  forcedQuery,
  rowNumber,
  editableField,
  onEditValue,
  editHint,
}: {
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  // Name of the column holding an ISO ("YYYY-MM-DD") date — turns on the
  // date-range filter. Omitted for reports with no natural date (e.g. a
  // mechanic roster), which just get search instead.
  dateField?: string;
  // Name of a column holding a month label (e.g. "Aug 2026") — turns on a
  // Month dropdown instead of a day-range picker, for reports grouped by
  // month rather than individual dated transactions (Sales Performance).
  monthField?: string;
  // Plain "pick one value" dropdowns over any column(s) — each shows every
  // distinct value seen in its column, plus an "All <label>" reset option.
  // Used where a set of a few repeating values (e.g. Logs' Action or User
  // columns) is more useful to filter by exact match than free-text
  // search. Each entry gets its own independent dropdown.
  selectFilters?: { field: string; label: string }[];
  searchFields: string[];
  searchPlaceholder?: string;
  filename: string;
  // Name of a (not necessarily displayed) field on each row holding a
  // signed screenshot URL — when present, double-clicking a row with one
  // opens it full-size instead of doing nothing.
  imageField?: string;
  // Separate small tables (e.g. Point Allocation's per-branch counts, or
  // Jobsheet's revenue-by-week/month) shown elsewhere on the page — not
  // rendered here, only stitched onto the front of the CSV so exporting
  // the report also captures them.
  summarySections?: { title: string; columns: string[]; rows: (string | number)[][] }[];
  // Overwrites the search box from outside this component — e.g. a
  // clickable stat card above the table that wants clicking it to filter
  // the rows below, without needing to lift this component's whole filter
  // state up into its parent. Each distinct value (even the same string
  // clicked twice) re-applies, so the search box stays in sync with
  // whichever card was clicked most recently.
  forcedQuery?: string;
  // Numbers rows 1, 2, 3… in a leading "Bil." column, matching the
  // branches' own manually-kept sheets — recalculated off whatever's
  // currently filtered/searched, not the row's position in the full list.
  rowNumber?: boolean;
  // Which column's cell is click-to-edit — clicking it opens a small modal
  // (rather than editing in place) so a value that's already wrong isn't
  // mistaken for something safe to overtype directly in the table. Needs
  // onEditValue to actually do anything.
  editableField?: string;
  // Called with the row and the new value once the edit modal is saved;
  // the row list itself is owned by the server page, not this component,
  // so a successful edit just refreshes the page to pick up the new data.
  onEditValue?: (row: Record<string, string | number>, newValue: string) => Promise<{ error: string } | void>;
  // Small print shown under the edit modal's input — e.g. clarifying what
  // saving it actually does (or doesn't) touch, since that's specific to
  // whatever onEditValue does and this component has no way to know.
  editHint?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (forcedQuery !== undefined) setQuery(forcedQuery);
    // Only ever meant to react to forcedQuery changing, not query itself
    // (which would fight typing in the search box directly).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedQuery]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("all");
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<Record<string, string | number> | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(row: Record<string, string | number>) {
    if (!editableField) return;
    setEditingRow(row);
    setEditValue(String(row[editableField] ?? ""));
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingRow || !editableField || !onEditValue) return;
    setEditSaving(true);
    setEditError(null);
    const result = await onEditValue(editingRow, editValue);
    setEditSaving(false);
    if (result && "error" in result && result.error) {
      setEditError(result.error);
      return;
    }
    setEditingRow(null);
    router.refresh();
  }

  const months = useMemo(() => {
    if (!monthField) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const r of rows) {
      const value = String(r[monthField] ?? "");
      if (value && !seen.has(value)) {
        seen.add(value);
        list.push(value);
      }
    }
    return list;
  }, [rows, monthField]);

  const selectOptionsByField = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const sf of selectFilters ?? []) {
      const seen = new Set<string>();
      for (const r of rows) {
        const value = String(r[sf.field] ?? "");
        if (value) seen.add(value);
      }
      result[sf.field] = [...seen].sort((a, b) => a.localeCompare(b));
    }
    return result;
  }, [rows, selectFilters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !searchFields.some((f) => String(r[f] ?? "").toLowerCase().includes(q))) return false;
      if (dateField) {
        const value = String(r[dateField] ?? "");
        if (from && value < from) return false;
        if (to && value > to) return false;
      }
      if (monthField && month !== "all" && String(r[monthField] ?? "") !== month) return false;
      for (const sf of selectFilters ?? []) {
        const picked = selectValues[sf.field] ?? "all";
        if (picked !== "all" && String(r[sf.field] ?? "") !== picked) return false;
      }
      return true;
    });
  }, [rows, query, searchFields, dateField, from, to, monthField, month, selectFilters, selectValues]);

  function handleExport() {
    const mainCsv = toCsv(
      columns.map((c) => c.label),
      filtered.map((r) => columns.map((c) => r[c.key] ?? ""))
    );
    const csv = summarySections?.length
      ? [...summarySections.flatMap((s) => [s.title, toCsv(s.columns, s.rows), ""]), mainCsv].join("\n")
      : mainCsv;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logClientActivityAction("Exported report", `${filename} (${filtered.length} rows)`);
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-64"
          />
        </div>
        {monthField && (
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="appearance-none bg-white border border-neutral-200 hover:border-red-300 rounded-xl px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
          >
            <option value="all">All Months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {(selectFilters ?? []).map((sf) => (
          <select
            key={sf.field}
            value={selectValues[sf.field] ?? "all"}
            onChange={(e) => setSelectValues((cur) => ({ ...cur, [sf.field]: e.target.value }))}
            className="appearance-none bg-white border border-neutral-200 hover:border-red-300 rounded-xl px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
          >
            <option value="all">All {sf.label}</option>
            {(selectOptionsByField[sf.field] ?? []).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
        {dateField && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
            <span className="text-sm text-neutral-400">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
            {(from || to) && (
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-700"
              >
                Clear dates
              </button>
            )}
          </>
        )}
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap ml-auto"
        >
          <Download size={15} /> Export ({filtered.length})
        </button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200 bg-neutral-50">
              {rowNumber && <th className="font-medium px-4 py-2.5 whitespace-nowrap">Bil.</th>}
              {columns.map((c) => (
                <th key={c.key} className="font-medium px-4 py-2.5 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowNumber ? 1 : 0)} className="text-center text-neutral-500 py-10">
                  No matching rows.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => {
                const image = imageField ? r[imageField] : undefined;
                return (
                  <tr
                    key={i}
                    onDoubleClick={image ? () => setPreviewUrl(String(image)) : undefined}
                    title={image ? "Double-click to view the uploaded screenshot" : undefined}
                    className={`hover:bg-neutral-50 ${image ? "cursor-pointer" : ""}`}
                  >
                    {rowNumber && <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">{i + 1}</td>}
                    {columns.map((c) =>
                      editableField === c.key && onEditValue ? (
                        <td key={c.key} className="px-4 py-2.5 whitespace-nowrap">
                          <button
                            onClick={() => openEdit(r)}
                            className="flex items-center gap-1.5 text-neutral-700 hover:text-red-600 group"
                            title="Click to fill in the correct number"
                          >
                            {r[c.key] || <span className="text-neutral-400 italic">blank — click to fill in</span>}
                            <Pencil size={12} className="opacity-0 group-hover:opacity-100" />
                          </button>
                        </td>
                      ) : (
                        <td key={c.key} className="px-4 py-2.5 whitespace-nowrap text-neutral-700">
                          {r[c.key] ?? ""}
                        </td>
                      )
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {previewUrl && (
        <ModalPortal><div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-8"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-lg w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 bg-white text-neutral-700 rounded-full p-1.5 shadow-lg hover:text-red-600"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded screenshot"
              className="w-full max-h-[85vh] object-contain rounded-xl shadow-2xl bg-white"
            />
          </div>
        </div></ModalPortal>
      )}

      {editingRow && editableField && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
            onClick={() => !editSaving && setEditingRow(null)}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold text-neutral-900 mb-1">Fill in the correct number</p>
              <p className="text-xs text-neutral-500 mb-3">
                {editingRow.jobsheetNo ? `Jobsheet ${editingRow.jobsheetNo}` : ""}
                {editingRow.customerName ? ` — ${editingRow.customerName}` : ""}
              </p>
              <input
                type="text"
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                placeholder="e.g. 880101-14-5566"
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
              {editHint && <p className="text-xs text-neutral-400 mt-2">{editHint}</p>}
              {editError && <p className="text-xs text-red-600 mt-2">{editError}</p>}
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={() => setEditingRow(null)}
                  disabled={editSaving}
                  className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
