"use client";

import { useState } from "react";
import type { RevenuePace as RevenuePaceData, BranchRevenuePace } from "@/lib/revenue-pace-actions";
import { branchLabel } from "@/lib/branch";
import { formatCurrency } from "@/lib/format";
import { niceMax, shortAmount, useContainerWidth, LEFT_AXIS_WIDTH, LINE_CHART_TICKS, PAD_TOP } from "./TrendCharts";

const CHART_HEIGHT = 200;
const PAD_X = 24;

// Cumulative Actual (this month's revenue so far, running total) against
// the flat working-day pace needed to land exactly on target — the same
// "are we ahead or behind" read as the branch cards below, just as a curve
// instead of a single number. The Actual line stops at today; the Pace
// line keeps going to month-end so you can see where it's headed.
function RevenueRunRateChart({ data, title }: { data: RevenuePaceData; title: string }) {
  const [containerRef, containerWidth] = useContainerWidth(640);
  const { dailyPoints, today, totalDays, isRealToday } = data;
  // The marker sits on "today" until you move the mouse over the chart —
  // then it follows your cursor so you can check any day, not just today's.
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const dataMax = Math.max(1, ...dailyPoints.map((p) => Math.max(p.actual, p.paceNeeded)));
  const axisMax = niceMax(dataMax);

  const width = Math.max(containerWidth - LEFT_AXIS_WIDTH, 120);
  const step = dailyPoints.length > 1 ? (width - PAD_X * 2) / (dailyPoints.length - 1) : width - PAD_X * 2;

  const xAt = (i: number) => PAD_X + i * step;
  const yAt = (value: number) => PAD_TOP + CHART_HEIGHT - (value / axisMax) * CHART_HEIGHT;

  const actualPoints = today >= 1 ? dailyPoints.slice(0, today) : [];
  const actualPath = actualPoints.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.actual)}`).join(" ");
  const pacePath = dailyPoints.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.paceNeeded)}`).join(" ");

  const ticks = Array.from({ length: LINE_CHART_TICKS + 1 }, (_, i) => (axisMax / LINE_CHART_TICKS) * i);
  const markerDay = hoverDay ?? today;
  const markerPoint = markerDay >= 1 && markerDay <= totalDays ? dailyPoints[markerDay - 1] : null;
  const plotBottom = PAD_TOP + CHART_HEIGHT;
  const dayLabelY = plotBottom + 22;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = e.clientX - rect.left - LEFT_AXIS_WIDTH;
    const nearest = Math.round((svgX - PAD_X) / step) + 1;
    setHoverDay(Math.min(totalDays, Math.max(1, nearest)));
  }

  // The tooltip box would run off the right edge of the chart once the
  // marker is in the last third of the month, so it flips to sit left of
  // the marker instead of right of it.
  const tooltipOnLeft = markerPoint ? xAt(markerDay - 1) > width * 0.6 : false;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex flex-col items-start mb-4">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500 mt-0.5">
          Actual revenue against the pace needed to hit {formatCurrency(data.combinedTarget)}
        </p>
        <div className="flex items-center gap-4 text-xs text-neutral-500 mt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[3px] rounded-full bg-red-500 inline-block" /> Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0 border-t-2 border-dashed border-neutral-400 inline-block" /> Pace needed
          </span>
        </div>
      </div>
      <div ref={containerRef} className="overflow-x-auto relative">
        <svg
          width={width + LEFT_AXIS_WIDTH}
          height={dayLabelY + 10}
          className="min-w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverDay(null)}
        >
          <g transform={`translate(${LEFT_AXIS_WIDTH}, 0)`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={width} y1={yAt(t)} y2={yAt(t)} className="stroke-neutral-100" strokeWidth={1} />
                <text x={-8} y={yAt(t)} dy={3} textAnchor="end" className="fill-neutral-400 text-[11px]">
                  {shortAmount(t)}
                </text>
              </g>
            ))}
            {dailyPoints.map((p, i) =>
              i % Math.max(1, Math.ceil(dailyPoints.length / 20)) === 0 ? (
                <text key={p.day} x={xAt(i)} y={dayLabelY} textAnchor="middle" className="fill-neutral-500 text-[11px]">
                  {p.day}
                </text>
              ) : null
            )}
            <path d={pacePath} fill="none" strokeWidth={2} strokeDasharray="6 4" className="stroke-neutral-400" />
            {actualPath && <path d={actualPath} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-red-600" />}
            {markerPoint && (
              <g>
                <line
                  x1={xAt(markerDay - 1)}
                  x2={xAt(markerDay - 1)}
                  y1={PAD_TOP}
                  y2={plotBottom}
                  className="stroke-neutral-300"
                  strokeWidth={1}
                />
                <circle cx={xAt(markerDay - 1)} cy={yAt(markerPoint.paceNeeded)} r={4} className="fill-neutral-400" />
                {markerDay <= today && <circle cx={xAt(markerDay - 1)} cy={yAt(markerPoint.actual)} r={4} className="fill-red-500" />}
              </g>
            )}
          </g>
        </svg>
        {markerPoint && (
          <div
            className="absolute top-2 bg-white border border-neutral-200 rounded-lg shadow-sm px-3 py-2 text-xs pointer-events-none"
            style={{
              left: tooltipOnLeft ? undefined : LEFT_AXIS_WIDTH + xAt(markerDay - 1) + 12,
              right: tooltipOnLeft ? width + LEFT_AXIS_WIDTH - xAt(markerDay - 1) + 12 : undefined,
            }}
          >
            <p className="font-semibold text-neutral-900">
              Day {markerDay}
              {markerDay === today && !hoverDay && isRealToday ? " (today)" : ""}
            </p>
            {markerDay <= today && (
              <p className="text-neutral-600 mt-1">
                Actual <span className="text-neutral-900 font-medium tabular-nums">{formatCurrency(markerPoint.actual)}</span>
              </p>
            )}
            <p className="text-neutral-600">
              Pace needed <span className="text-neutral-900 font-medium tabular-nums">{formatCurrency(markerPoint.paceNeeded)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BranchRevenueCard({
  pace,
  revenueToday,
  asOfDay,
  isRealToday,
}: {
  pace: BranchRevenuePace;
  revenueToday: number;
  asOfDay: number;
  isRealToday: boolean;
}) {
  const pct = pace.target > 0 ? Math.min(100, Math.floor((pace.achieved / pace.target) * 100)) : 0;
  const markerPct = pace.target > 0 ? Math.min(100, Math.round((pace.expectedByToday / pace.target) * 100)) : 0;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-neutral-900 whitespace-nowrap">{branchLabel(pace.branch)}</p>
        {pace.hasTarget ? (
          pace.onTrack ? (
            <span className="text-xs text-emerald-700 whitespace-nowrap">On track</span>
          ) : (
            <span className="text-xs text-red-700 tabular-nums text-right">{formatCurrency(pace.behindAmount)} behind</span>
          )
        ) : (
          <span className="text-xs text-neutral-500 whitespace-nowrap">No target set</span>
        )}
      </div>

      <p className="text-2xl font-semibold tabular-nums text-neutral-900">
        {formatCurrency(pace.achieved)}
        {pace.hasTarget && <span className="text-sm font-normal text-neutral-500"> / {formatCurrency(pace.target)}</span>}
      </p>

      {pace.hasTarget && (
        <>
          <div className="relative mt-4">
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pace.onTrack ? "bg-emerald-600" : "bg-red-600"}`} style={{ width: `${pct}%` }} />
            </div>
            <div aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 -ml-px rounded-full bg-neutral-900" style={{ left: `${markerPct}%` }} />
          </div>
          <div className="flex items-center justify-between gap-3 mt-2 text-xs text-neutral-500">
            <p className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block w-0.5 h-3 rounded-full bg-neutral-900" />
              Should be <span className="tabular-nums">{formatCurrency(pace.expectedByToday)}</span> by {isRealToday ? "today" : `day ${asOfDay}`}
            </p>
            <p className="whitespace-nowrap tabular-nums">
              {formatCurrency(revenueToday)} {isRealToday ? "today" : `on day ${asOfDay}`}
            </p>
          </div>
          <p className="mt-4 pt-3 border-t border-neutral-100 text-xs text-neutral-600">
            Needs <span className="font-medium text-neutral-900 tabular-nums">{formatCurrency(pace.dailyQuota)}</span> a day, every working day,
            to hit the target
          </p>
        </>
      )}
    </div>
  );
}

export default function RevenuePace({ data, title = "Revenue run-rate, all branches" }: { data: RevenuePaceData; title?: string }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-neutral-900">Pace to target by branch</p>
        <div
          className={`mt-3 grid ${data.branches.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"} gap-4`}
        >
          {data.branches.map((b) => (
            <BranchRevenueCard
              key={b.branch}
              pace={b}
              revenueToday={b.revenueToday}
              asOfDay={data.today}
              isRealToday={data.isRealToday}
            />
          ))}
        </div>
      </div>
      <RevenueRunRateChart data={data} title={title} />
    </div>
  );
}
