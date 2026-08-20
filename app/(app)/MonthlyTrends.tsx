import type { MonthlyTrendPoint } from "@/lib/trends-actions";
import type { ClaimStatusBreakdownRow, PackageBreakdownRow } from "@/lib/dashboard-breakdowns-actions";
import { type Branch } from "@/lib/branch";
import { BranchJobsChart } from "./TrendCharts";
import { PieChartCard, type PieSlice } from "./PieChart";
import RestoreBikeStatus, { type RestoreBikeStatusCounts } from "./RestoreBikeStatus";
import PackageBreakdownCharts from "./PackageBreakdownCharts";

const CLAIM_STATUS_COLORS: Record<ClaimStatusBreakdownRow["status"], { colorClass: string; dot: string }> = {
  "In Process": { colorClass: "fill-amber-500", dot: "bg-amber-500" },
  Proceed: { colorClass: "fill-emerald-500", dot: "bg-emerald-500" },
  Rejected: { colorClass: "fill-red-500", dot: "bg-red-500" },
  "Close Ticket": { colorClass: "fill-indigo-500", dot: "bg-indigo-500" },
};

export default function MonthlyTrends({
  points,
  claimStatusBreakdown,
  packageBreakdown,
  restoreBikeStatusCounts,
  onlyBranch,
}: {
  points: MonthlyTrendPoint[];
  claimStatusBreakdown: ClaimStatusBreakdownRow[];
  packageBreakdown: Record<Branch, PackageBreakdownRow[]>;
  restoreBikeStatusCounts: RestoreBikeStatusCounts;
  onlyBranch?: Branch;
}) {
  const claimSlices: PieSlice[] = claimStatusBreakdown.map((row) => ({
    label: row.status,
    value: row.count,
    ...CLAIM_STATUS_COLORS[row.status],
  }));

  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900 mb-3">Trends</p>
      <div className="space-y-4">
        <BranchJobsChart points={points} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PieChartCard
            heading="Warranty Claims by Status"
            subtitle={onlyBranch ? "This month" : "All branches, this month"}
            slices={claimSlices}
          />
          <RestoreBikeStatus counts={restoreBikeStatusCounts} />
        </div>
        <PackageBreakdownCharts packageBreakdown={packageBreakdown} onlyBranch={onlyBranch} />
      </div>
    </div>
  );
}
