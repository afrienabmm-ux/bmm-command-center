import { getMonthlyTrends, type MonthlyTrendPoint } from "@/lib/trends-actions";

const CHART_HEIGHT = 120;
const BAR_GAP = 6;

function scale(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * CHART_HEIGHT));
}

// Rounds a max value up to a "nice" number (1/2/2.5/5 × a power of ten) so
// the gridlines land on tidy amounts instead of the raw data max.
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function shortAmount(value: number): string {
  return Math.round(value).toLocaleString("en-MY");
}

const LINE_CHART_HEIGHT = 220;
const LINE_CHART_TICKS = 5;

// Two lines per month (target, achieved) with gridlines and a value label
// on every point, drawn as plain SVG rather than pulling in a charting
// library for a handful of points.
function RevenueTrendChart({ points }: { points: MonthlyTrendPoint[] }) {
  const dataMax = Math.max(1, ...points.map((p) => Math.max(p.targetAmount, p.achievedAmount)));
  const axisMax = niceMax(dataMax);
  const step = 110;
  const padX = 32;
  const padTop = 24;
  const width = Math.max((points.length - 1) * step + padX * 2, 360);

  const xAt = (i: number) => padX + i * step;
  const yAt = (value: number) => padTop + LINE_CHART_HEIGHT - (value / axisMax) * LINE_CHART_HEIGHT;

  const targetPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.targetAmount)}`).join(" ");
  const achievedPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.achievedAmount)}`).join(" ");

  const ticks = Array.from({ length: LINE_CHART_TICKS + 1 }, (_, i) => (axisMax / LINE_CHART_TICKS) * i);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex flex-col items-center mb-4 text-center">
        <p className="text-sm font-semibold text-neutral-900">Revenue: Target vs Achieved</p>
        <p className="text-xs text-neutral-500 mt-0.5">Last {points.length} months, all branches combined</p>
        <div className="flex items-center gap-4 text-xs text-neutral-500 mt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[3px] rounded-full bg-neutral-400 inline-block" /> Target
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[3px] rounded-full bg-indigo-500 inline-block" /> Achieved
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg width={width + 44} height={padTop + LINE_CHART_HEIGHT + 36} className="min-w-full">
          <g transform="translate(44, 0)">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={0}
                  x2={width}
                  y1={yAt(t)}
                  y2={yAt(t)}
                  className="stroke-neutral-100"
                  strokeWidth={1}
                />
                <text x={-8} y={yAt(t)} dy={3} textAnchor="end" className="fill-neutral-400 text-[10px]">
                  {shortAmount(t)}
                </text>
              </g>
            ))}
            <path d={targetPath} fill="none" strokeWidth={3} className="stroke-neutral-400" />
            <path d={achievedPath} fill="none" strokeWidth={3} className="stroke-indigo-500" />
            {points.map((p, i) => {
              const targetY = yAt(p.targetAmount);
              const achievedY = yAt(p.achievedAmount);
              const achievedAbove = achievedY <= targetY;
              return (
                <g key={`${p.year}-${p.month}`}>
                  <text
                    x={xAt(i)}
                    y={achievedAbove ? targetY + 16 : targetY - 8}
                    textAnchor="middle"
                    className="fill-neutral-500 text-[10px] font-medium"
                  >
                    {shortAmount(p.targetAmount)}
                  </text>
                  <text
                    x={xAt(i)}
                    y={achievedAbove ? achievedY - 8 : achievedY + 16}
                    textAnchor="middle"
                    className="fill-indigo-600 text-[10px] font-semibold"
                  >
                    {shortAmount(p.achievedAmount)}
                  </text>
                  <text
                    x={xAt(i)}
                    y={padTop + LINE_CHART_HEIGHT + 18}
                    textAnchor="middle"
                    className="fill-neutral-500 text-[10px] font-medium uppercase"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </g>
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
