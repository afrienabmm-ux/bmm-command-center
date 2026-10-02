"use client";

import { useState } from "react";

// GenBlu Register (customer enrollment), New Registration — split by who
// signed the customer up: a salesperson (forwarded from the Sales
// Dashboard) or our own admin/service staff, kept apart so the two never
// mix — and Point Allocation (the monthly counts/points log). Tab-switched
// rather than stacked, same pattern as the Claims page.
type Tab = "tracker" | "salesman" | "admin" | "allocations";

export default function GenbluTabs({
  registeredCount,
  salesmanCount,
  adminCount,
  allocationCount,
  tracker,
  salesmanRegistrations,
  adminRegistrations,
  allocations,
}: {
  registeredCount: number;
  salesmanCount: number;
  adminCount: number;
  allocationCount: number;
  tracker: React.ReactNode;
  salesmanRegistrations: React.ReactNode;
  adminRegistrations: React.ReactNode;
  allocations: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("tracker");
  const tabs: { key: Tab; label: string }[] = [
    { key: "tracker", label: `GenBlu Tracker (${registeredCount})` },
    { key: "salesman", label: `New Reg — Salesman (${salesmanCount})` },
    { key: "admin", label: `New Reg — Admin (${adminCount})` },
    { key: "allocations", label: `GenBlu Allocations (${allocationCount})` },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-6 max-w-3xl">
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
      <div className={tab === "admin" ? "" : "hidden"}>{adminRegistrations}</div>
      <div className={tab === "allocations" ? "" : "hidden"}>{allocations}</div>
    </div>
  );
}
