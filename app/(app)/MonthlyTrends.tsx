import type { MonthlyTrendPoint } from "@/lib/trends-actions";
import { RevenueTrendChart, BranchJobsChart } from "./TrendCharts";

const CHART_HEIGHT = 120;

function scale(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * CHART_HEIGHT));
}

// Single-series bar chart used for the two remaining counts (claims,
// packages sold) — same scale/label mechanics as the revenue chart.
function CountTrendChart({
  heading,
  subtitle,
  points,
  valueOf,
  colorClass,
}: {
  heading: string;
  subtitle: string;
  points: MonthlyTrendPoint[];
  valueOf: (p: MonthlyTrendPoint) => number;
  colorClass: string;
}) {
  const values = points.map(valueOf);
  const max = Math.max(1, ...values);
  const barWidth = 20;
  const width = points.length * (barWidth + 16);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-neutral-900">{heading}</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">{subtitle}</p>
      <div className="overflow-x-auto">
        <svg width={Math.max(width, 240)} height={CHART_HEIGHT + 36} className="min-w-full">
          {points.map((p, i) => {
            const value = valueOf(p);
            const h = scale(value, max);
            const x = i * (barWidth + 16) + 8;
            return (
              <g key={`${p.year}-${p.month}`}>
                <rect x={x} y={CHART_HEIGHT - h} width={barWidth} height={h} rx={3} className={colorClass} />
                <text x={x + barWidth / 2} y={CHART_HEIGHT - h - 4} textAnchor="middle" className="fill-neutral-600 text-[10px] font-medium">
                  {value > 0 ? value : ""}
                </text>
                <text x={x + barWidth / 2} y={CHART_HEIGHT + 18} textAnchor="middle" className="fill-neutral-500 text-[10px]">
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function MonthlyTrends({ points }: { points: MonthlyTrendPoint[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900 mb-3">Trends</p>
      <div className="space-y-4">
        <RevenueTrendChart points={points} />
        <BranchJobsChart points={points} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CountTrendChart
            heading="Warranty Claims Submitted"
            subtitle="All branches, per month"
            points={points}
            valueOf={(p) => p.warrantyClaimsSubmitted}
            colorClass="fill-amber-500"
          />
          <CountTrendChart
            heading="Services Combo Sold"
            subtitle="All branches, per month"
            points={points}
            valueOf={(p) => p.packagesSold}
            colorClass="fill-purple-500"
          />
        </div>
      </div>
    </div>
  );
}
