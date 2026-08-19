import type { MonthlyTrendPoint } from "@/lib/trends-actions";
import type { ClaimStatusBreakdownRow, PackageBreakdownRow } from "@/lib/dashboard-breakdowns-actions";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { RevenueTrendChart, BranchJobsChart } from "./TrendCharts";
import { PieChartCard, type PieSlice } from "./PieChart";

const CLAIM_STATUS_COLORS: Record<ClaimStatusBreakdownRow["status"], { colorClass: string; dot: string }> = {
  Pending: { colorClass: "fill-neutral-400", dot: "bg-neutral-400" },
  "In Progress": { colorClass: "fill-amber-500", dot: "bg-amber-500" },
  Approved: { colorClass: "fill-emerald-500", dot: "bg-emerald-500" },
  Rejected: { colorClass: "fill-red-500", dot: "bg-red-500" },
  Closed: { colorClass: "fill-indigo-500", dot: "bg-indigo-500" },
};

const PACKAGE_COLOR_PALETTE: { colorClass: string; dot: string }[] = [
  { colorClass: "fill-indigo-500", dot: "bg-indigo-500" },
  { colorClass: "fill-emerald-500", dot: "bg-emerald-500" },
  { colorClass: "fill-amber-500", dot: "bg-amber-500" },
  { colorClass: "fill-rose-500", dot: "bg-rose-500" },
  { colorClass: "fill-purple-500", dot: "bg-purple-500" },
  { colorClass: "fill-sky-500", dot: "bg-sky-500" },
  { colorClass: "fill-orange-500", dot: "bg-orange-500" },
  { colorClass: "fill-lime-500", dot: "bg-lime-500" },
];

export default function MonthlyTrends({
  points,
  claimStatusBreakdown,
  packageBreakdown,
}: {
  points: MonthlyTrendPoint[];
  claimStatusBreakdown: ClaimStatusBreakdownRow[];
  packageBreakdown: Record<Branch, PackageBreakdownRow[]>;
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
        <RevenueTrendChart points={points} />
        <BranchJobsChart points={points} />
        <PieChartCard heading="Warranty Claims by Status" subtitle="All branches, this month" slices={claimSlices} />
        <div>
          <p className="text-sm font-semibold text-neutral-900 mb-3">Services Combo Sold by Branch</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BRANCHES.map(({ value: branch }) => {
              const rows = packageBreakdown[branch] ?? [];
              const slices: PieSlice[] = rows.map((row, i) => ({
                label: row.name,
                value: row.count,
                ...PACKAGE_COLOR_PALETTE[i % PACKAGE_COLOR_PALETTE.length],
              }));
              return (
                <PieChartCard key={branch} heading={branchLabel(branch)} subtitle="Package sold this month" slices={slices} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
