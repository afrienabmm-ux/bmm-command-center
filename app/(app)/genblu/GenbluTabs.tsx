"use client";

import { createContext, useContext, useMemo, useState } from "react";

function malaysiaDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

// The month and dates are shared by every registration tab, so the counts on
// the tab buttons and the list underneath always cover the same period.
type GenbluDates = {
  months: string[];
  month: string;
  setMonth: (ym: string) => void;
  fromDate: string;
  setFromDate: (d: string) => void;
  toDate: string;
  setToDate: (d: string) => void;
};
const GenbluDatesContext = createContext<GenbluDates | null>(null);

export function useGenbluDates(): GenbluDates {
  const dates = useContext(GenbluDatesContext);
  if (!dates) throw new Error("useGenbluDates must be used inside GenbluTabs");
  return dates;
}

export function inGenbluDates(iso: string, fromDate: string, toDate: string): boolean {
  const d = malaysiaDate(iso);
  return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
}

// GenBlu Register (customer enrollment), New Registration — split by who
// signed the customer up: a salesperson (forwarded from the Sales
// Dashboard) or our own admin/service staff, kept apart so the two never
// mix, with salesman sign-ups who already had points kept on a tab of their
// own — and Point Allocation (the monthly counts/points log). Tab-switched
// rather than stacked, same pattern as the Claims page.
type Tab = "tracker" | "salesman" | "salesmanExisting" | "admin" | "allocations";

export default function GenbluTabs({
  registeredDates,
  salesmanDates,
  salesmanExistingDates,
  adminDates,
  allocationCount,
  tracker,
  salesmanRegistrations,
  salesmanExistingRegistrations,
  adminRegistrations,
  allocations,
}: {
  registeredDates: string[];
  salesmanDates: string[];
  salesmanExistingDates: string[];
  adminDates: string[];
  allocationCount: number;
  tracker: React.ReactNode;
  salesmanRegistrations: React.ReactNode;
  salesmanExistingRegistrations: React.ReactNode;
  adminRegistrations: React.ReactNode;
  allocations: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("tracker");
  const [month, setMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const months = useMemo(
    () =>
      [...new Set([...registeredDates, ...salesmanDates, ...salesmanExistingDates, ...adminDates].map((d) => malaysiaDate(d).slice(0, 7)))]
        .sort()
        .reverse(),
    [registeredDates, salesmanDates, salesmanExistingDates, adminDates]
  );
  const count = (dates: string[]) => dates.filter((d) => inGenbluDates(d, fromDate, toDate)).length;
  const tabs: { key: Tab; label: string }[] = [
    { key: "tracker", label: `GenBlu Tracker (${count(registeredDates)})` },
    { key: "salesman", label: `New Reg — Salesman (${count(salesmanDates)})` },
    { key: "salesmanExisting", label: `Salesman — Existing (${count(salesmanExistingDates)})` },
    { key: "admin", label: `New Reg — Admin (${count(adminDates)})` },
    { key: "allocations", label: `GenBlu Allocations (${allocationCount})` },
  ];

  return (
    <GenbluDatesContext.Provider value={{ months, month, setMonth, fromDate, setFromDate, toDate, setToDate }}>
    <div>
      <div className="flex flex-wrap gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-6 max-w-5xl">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={tab === "tracker" ? "" : "hidden"}>{tracker}</div>
      <div className={tab === "salesman" ? "" : "hidden"}>{salesmanRegistrations}</div>
      <div className={tab === "salesmanExisting" ? "" : "hidden"}>{salesmanExistingRegistrations}</div>
      <div className={tab === "admin" ? "" : "hidden"}>{adminRegistrations}</div>
      <div className={tab === "allocations" ? "" : "hidden"}>{allocations}</div>
    </div>
    </GenbluDatesContext.Provider>
  );
}
