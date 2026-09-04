import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import type { MechanicPerformanceRow } from "@/lib/reports-actions";
import { formatCurrency } from "@/lib/format";

const SHOWN = 5;

// The one section that's genuinely branch-specific rather than a scaled-down
// copy of the All Branches view — a company-wide leaderboard doesn't mean
// much once you're already looking at one branch, but "who's leading this
// branch this month" does.
export default function BranchMechanicLeaderboard({ rows }: { rows: MechanicPerformanceRow[] }) {
  const ranked = [...rows].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, SHOWN);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
            <Trophy size={15} className="text-amber-500" /> Top Mechanics This Branch
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">Ranked by total revenue this month</p>
        </div>
        <Link href="/sales-performance" className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors whitespace-nowrap">
          View all →
        </Link>
      </div>
      {ranked.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-10">No mechanic activity yet this month.</p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {ranked.map((r, i) => (
            <div key={r.mechanicId} className="flex items-center gap-3 px-5 py-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  i === 0 ? "bg-amber-500/15 text-amber-700" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {i === 0 ? <Crown size={12} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-800 truncate">
                  {r.shortCode}
                </p>
                <p className="text-xs text-neutral-500">{r.walkInCount} jobs</p>
              </div>
              <p className="text-sm font-semibold text-neutral-900 whitespace-nowrap">{formatCurrency(r.totalRevenue)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
