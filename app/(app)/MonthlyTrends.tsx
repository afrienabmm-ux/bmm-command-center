import { getMonthlyTrends, type MonthlyTrendPoint } from "@/lib/trends-actions";

const CHART_HEIGHT = 120;
const BAR_GAP = 6;

function scale(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * CHART_HEIGHT));
}

// Two bars per month (target, achieved) sharing one scale, drawn as plain
// SVG rather than pulling in a charting library for a handful of bars.
function RevenueTrendChart({ points }: { points: MonthlyTrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.targetAmount, p.achievedAmount)));
  const barWidth = 14;
  const groupWidth = barWidth * 2 + BAR_GAP;
  const width = points.length * (groupWidth + 16);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Revenue: Target vs Achieved</p>
          <p className="text-xs text-neutral-500 mt-0.5">Last {points.length} months, all branches combined</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-neutral-300 inline-block" /> Target
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Achieved
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg width={Math.max(width, 320)} height={CHART_HEIGHT + 36} className="min-w-full">
          {points.map((p, i) => {
            const x = i * (groupWidth + 16) + 8;
            const targetH = scale(p.targetAmount, max);
            const achievedH = scale(p.achievedAmount, max);
            return (
              <g key={`${p.year}-${p.month}`}>
                <rect x={x} y={CHART_HEIGHT - targetH} width={barWidth} height={targetH} rx={2} className="fill-neutral-300" />
                <rect
                  x={x + barWidth + BAR_GAP}
                  y={CHART_HEIGHT - achievedH}
                  width={barWidth}
                  height={achievedH}
                  rx={2}
                  className={p.achievedAmount >= p.targetAmount && p.targetAmount > 0 ? "fill-emerald-500" : "fill-indigo-500"}
                />
                <text x={x + groupWidth / 2 - BAR_GAP / 2} y={CHART_HEIGHT + 18} textAnchor="middle" className="fill-neutral-500 text-[10px]">
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

// Single-series bar chart used for the three simpler counts (repair jobs,
// claims, packages sold) — same scale/label mechanics as the revenue chart.
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

export default async function MonthlyTrends({ year, month }: { year: number; month: number }) {
  const points = await getMonthlyTrends(year, month, 6);

  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900 mb-3">Trends</p>
      <div className="space-y-4">
        <RevenueTrendChart points={points} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CountTrendChart
            heading="Repair Jobs Completed"
            subtitle="Restore Bike + Walk-in, per month"
            points={points}
            valueOf={(p) => p.repairJobsCompleted}
            colorClass="fill-indigo-500"
          />
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
