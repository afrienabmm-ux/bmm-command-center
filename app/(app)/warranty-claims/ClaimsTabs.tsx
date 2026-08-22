"use client";

import { useState } from "react";

// Warranty Claim and Delivery Claim are two different forms/tables that
// share this one page — tab-switched rather than stacked, same pattern as
// the phone /scan page's Jobsheet/GenBlu tabs.
export default function ClaimsTabs({
  warrantyCount,
  deliveryCount,
  warranty,
  delivery,
}: {
  warrantyCount: number;
  deliveryCount: number;
  warranty: React.ReactNode;
  delivery: React.ReactNode;
}) {
  const [tab, setTab] = useState<"warranty" | "delivery">("warranty");

  return (
    <div>
      <div className="flex gap-1 bg-neutral-100 border border-neutral-200 rounded-lg p-1 mb-6 max-w-md">
        <button
          onClick={() => setTab("warranty")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "warranty" ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          Warranty Claim ({warrantyCount})
        </button>
        <button
          onClick={() => setTab("delivery")}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "delivery" ? "bg-white text-red-700 shadow-sm" : "text-neutral-600"
          }`}
        >
          Delivery Claim ({deliveryCount})
        </button>
      </div>
      <div className={tab === "warranty" ? "" : "hidden"}>{warranty}</div>
      <div className={tab === "delivery" ? "" : "hidden"}>{delivery}</div>
    </div>
  );
}
