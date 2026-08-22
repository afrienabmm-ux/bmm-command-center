import type { PackageBreakdownRow } from "@/lib/dashboard-breakdowns-actions";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { PieChartCard, type PieSlice } from "./PieChart";

const PACKAGE_COLOR_PALETTE: { colorClass: string; dot: string }[] = [
  { colorClass: "fill-red-500", dot: "bg-red-500" },
  { colorClass: "fill-emerald-500", dot: "bg-emerald-500" },
  { colorClass: "fill-amber-500", dot: "bg-amber-500" },
  { colorClass: "fill-rose-500", dot: "bg-rose-500" },
  { colorClass: "fill-teal-500", dot: "bg-teal-500" },
  { colorClass: "fill-sky-500", dot: "bg-sky-500" },
  { colorClass: "fill-orange-500", dot: "bg-orange-500" },
  { colorClass: "fill-lime-500", dot: "bg-lime-500" },
];

// The per-branch "Services Combo Sold" pie charts — shared by the Dashboard
// (inside Trends) and the Sales Performance page, so both stay in sync
// without duplicating the chart markup.
export default function PackageBreakdownCharts({
  packageBreakdown,
  onlyBranch,
}: {
  packageBreakdown: Record<Branch, PackageBreakdownRow[]>;
  onlyBranch?: Branch;
}) {
  const comboBranches = onlyBranch ? BRANCHES.filter((b) => b.value === onlyBranch) : BRANCHES;

  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900 mb-3">
        {onlyBranch ? "Services Combo Sold" : "Services Combo Sold by Branch"}
      </p>
      <div className={onlyBranch ? "grid grid-cols-1 max-w-sm gap-4" : "grid grid-cols-1 md:grid-cols-3 gap-4"}>
        {comboBranches.map(({ value: branch }) => {
          const rows = packageBreakdown[branch] ?? [];
          const slices: PieSlice[] = rows.map((row, i) => ({
            label: row.name,
            value: row.count,
            ...PACKAGE_COLOR_PALETTE[i % PACKAGE_COLOR_PALETTE.length],
          }));
          return <PieChartCard key={branch} heading={branchLabel(branch)} subtitle="Package sold this month" slices={slices} />;
        })}
      </div>
    </div>
  );
}
