"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ClaimStatusBreakdownRow } from "@/lib/dashboard-breakdowns-actions";
import { PieChartBody, type PieSlice } from "./PieChart";

const CLAIM_STATUS_COLORS: Record<ClaimStatusBreakdownRow["status"], { colorClass: string; dot: string }> = {
  "In Process": { colorClass: "fill-amber-500", dot: "bg-amber-500" },
  Proceed: { colorClass: "fill-emerald-500", dot: "bg-emerald-500" },
  Rejected: { colorClass: "fill-red-500", dot: "bg-red-500" },
  "Close Ticket": { colorClass: "fill-red-500", dot: "bg-red-500" },
};

type ClaimType = "warranty" | "delivery";

// Same pie card as the other Dashboard breakdowns, but with a dropdown to
// switch between Warranty Claim and Delivery Claim status counts instead of
// showing only one — both are pre-fetched server-side so switching is
// instant, no round trip.
export default function ClaimStatusPieCard({
  warranty,
  delivery,
  subtitle,
}: {
  warranty: ClaimStatusBreakdownRow[];
  delivery: ClaimStatusBreakdownRow[];
  subtitle: string;
}) {
  const [claimType, setClaimType] = useState<ClaimType>("warranty");
  const rows = claimType === "warranty" ? warranty : delivery;
  const slices: PieSlice[] = rows.map((row) => ({
    label: row.status,
    value: row.count,
    ...CLAIM_STATUS_COLORS[row.status],
  }));

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {claimType === "warranty" ? "Warranty Claims by Status" : "Delivery Claims by Status"}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="relative shrink-0">
          <select
            value={claimType}
            onChange={(e) => setClaimType(e.target.value as ClaimType)}
            className="appearance-none text-xs font-medium bg-neutral-50 border border-neutral-200 hover:border-red-300 rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-100 transition-colors cursor-pointer"
          >
            <option value="warranty">Warranty Claim</option>
            <option value="delivery">Delivery Claim</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>
      <PieChartBody slices={slices} />
    </div>
  );
}
