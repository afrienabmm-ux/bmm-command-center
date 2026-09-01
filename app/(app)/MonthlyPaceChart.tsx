"use client";

import { MONTH_NAMES, formatCurrency } from "@/lib/format";
import { niceMax, shortAmount, useContainerWidth, LEFT_AXIS_WIDTH, PAD_TOP } from "./TrendCharts";
import type { MonthlyTargetHistoryPoint } from "@/lib/reports-actions";

const CHART_HEIGHT = 200;
const BAR_GAP_FRACTION = 0.35;
const AXIS_TICKS = 5;

// Monthly achieved-vs-target, last several months — the current month
// (right-most bar) is highlighted since it's still in progress, unlike the
// finished months beside it. A single dashed line marks the current
// month's target since that's the number the "need X/day" math below is
// actually chasing.
export default function MonthlyPaceChart({
  points,
  workingDaysRemaining,
  title = "Pace to Target",
}: {
  points: MonthlyTargetHistoryPoint[];
  workingDaysRemaining: number;
  title?: string;
}) {
  const [containerRef, containerWidth] = useContainerWidth(640);
  const current = points[points.length - 1];
  const target = current?.target ?? 0;
  const achieved = current?.achieved ?? 0;
  const pct = target > 0 ? Math.round((achieved / target) * 100) : 0;
  const remaining = Math.max(0, target - achieved);
  const perDay = workingDaysRemaining > 0 ? Math.ceil(remaining / workingDaysRemaining) : 0;

  const dataMax = Math.max(1, target, ...points.map((p) => p.achieved));
  const axisMax = niceMax(dataMax);
  const width = Math.max(containerWidth - LEFT_AXIS_WIDTH, 120);
  const slot = points.length > 0 ? width / points.length : width;
  const barWidth = slot * (1 - BAR_GAP_FRACTION);

  const yAt = (value: number) => PAD_TOP + CHART_HEIGHT - (value / axisMax) * CHART_HEIGHT;
  const targetY = yAt(target);
  const ticks = Array.from({ length: AXIS_TICKS + 1 }, (_, i) => (axisMax / AXIS_TICKS) * i);
  const plotBottom = PAD_TOP + CHART_HEIGHT;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {target > 0 && (
          <p className="text-xs text-neutral-500 text-right">
            {formatCurrency(achieved)} of {formatCurrency(target)} ({pct}%) ·{" "}
            <span className="text-amber-600 font-medium">
              need {formatCurrency(perDay)}/day for {workingDaysRemaining} working day{workingDaysRemaining === 1 ? "" : "s"} left
            </span>
          </p>
        )}
      </div>
      <div ref={containerRef} className="overflow-x-auto relative">
        <svg width={width + LEFT_AXIS_WIDTH} height={plotBottom + 30} className="min-w-full">
          <g transform={`translate(${LEFT_AXIS_WIDTH}, 0)`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={width} y1={yAt(t)} y2={yAt(t)} className="stroke-neutral-100" strokeWidth={1} />
                <text x={-8} y={yAt(t)} dy={3} textAnchor="end" className="fill-neutral-400 text-[10px]">
                  {shortAmount(t)}
                </text>
              </g>
            ))}
            {target > 0 && (
              <>
                <line x1={0} x2={width} y1={targetY} y2={targetY} strokeDasharray="6 4" strokeWidth={2} className="stroke-red-400" />
                <text x={width} y={targetY - 6} textAnchor="end" className="fill-red-500 text-[10px] font-medium">
                  Target {shortAmount(target)}
                </text>
              </>
            )}
            {points.map((p, i) => {
              const isCurrent = i === points.length - 1;
              const barHeight = Math.max(0, plotBottom - yAt(p.achieved));
              const x = i * slot + (slot - barWidth) / 2;
              return (
                <g key={`${p.year}-${p.month}`}>
                  <rect
                    x={x}
                    y={yAt(p.achieved)}
                    width={barWidth}
                    height={barHeight}
                    rx={4}
                    className={isCurrent ? "fill-sky-400" : "fill-neutral-300"}
                  />
                  <text x={x + barWidth / 2} y={plotBottom + 18} textAnchor="middle" className="fill-neutral-500 text-[10px]">
                    {MONTH_NAMES[p.month - 1].slice(0, 3)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <p className="text-xs text-neutral-400 mt-2">
        Last {points.length} months · current month (blue) is month-to-date.
      </p>
    </div>
  );
}
