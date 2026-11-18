"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Download, Search } from "lucide-react";
import { toCsv } from "@/lib/format";
import { branchLabel } from "@/lib/branch";
import type { AppCustomer } from "@/lib/app-customers";

const STATUS_LABEL: Record<string, string> = { booked: "Booked", arrived: "Arrived", no_show: "No-show", cancelled: "Cancelled" };

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" });
}

function plain(s: string): string {
  return s.toLowerCase().replace(/[\s-]/g, "");
}

export default function AppCustomersClient({ customers }: { customers: AppCustomer[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = plain(query);
    if (!q) return customers;
    return customers.filter((c) => [c.name, c.phone, c.email, ...c.bikes.map((b) => b.plate)].some((v) => plain(v).includes(q)));
  }, [customers, query]);

  function download() {
    const csv = toCsv(
      ["Name", "Phone", "Email", "Joined", "Bikes (plate)", "Bookings", "Last booking"],
      shown.map((c) => [
        c.name,
        c.phone,
        c.email,
        dateLabel(c.joinedAt),
        c.bikes.map((b) => b.plate).join(" / "),
        c.bookings.length,
        c.bookings[0]?.date ?? "",
      ])
    );
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `App customers - ${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email or plate"
            className="w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={download}
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Download (CSV)
        </button>
      </div>
      <p className="text-sm text-neutral-500">
        {shown.length} of {customers.length} customers. Emails and phone numbers are for BMM use only.
      </p>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-500 text-sm">No customers found.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((c) => {
            const isOpen = open === c.id;
            return (
              <li key={c.id} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-900 truncate">{c.name}</p>
                    <p className="text-sm text-neutral-600 truncate">{c.email}</p>
                    <p className="text-sm text-neutral-500">{c.phone}</p>
                  </div>
                  <div className="text-right text-xs text-neutral-500 shrink-0">
                    <p>
                      {c.bikes.length} bike{c.bikes.length === 1 ? "" : "s"}
                    </p>
                    <p>
                      {c.bookings.length} booking{c.bookings.length === 1 ? "" : "s"}
                    </p>
                    <p>Joined {dateLabel(c.joinedAt)}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-neutral-200 bg-neutral-50 p-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Saved bikes</p>
                      {c.bikes.length === 0 ? (
                        <p className="text-sm text-neutral-500">None saved.</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {c.bikes.map((b) => (
                            <li key={b.plate}>
                              <span className="font-semibold">{b.plate}</span> · {b.model}
                              {b.mileageKm != null ? ` · ${b.mileageKm.toLocaleString("en-MY")} km` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Bookings</p>
                      {c.bookings.length === 0 ? (
                        <p className="text-sm text-neutral-500">No bookings yet.</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {c.bookings.map((b) => (
                            <li key={b.bookingNo} className={b.status === "cancelled" ? "text-neutral-400 line-through" : ""}>
                              {b.date}
                              {b.slotTime ? ` ${b.slotTime}` : ` ${b.session.toUpperCase()}`} · {branchLabel(b.branch as never)} · {b.plate} ·{" "}
                              {STATUS_LABEL[b.status] ?? b.status} · <span className="text-neutral-500">{b.bookingNo}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
