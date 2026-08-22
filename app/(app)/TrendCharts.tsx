"use client";

import { useEffect, useRef, useState } from "react";
import type { MonthlyTrendPoint } from "@/lib/trends-actions";
import type { Branch } from "@/lib/branch";

// Rounds a max value up to a "nice" number (1/2/2.5/5 × a power of ten) so
// the gridlines land on tidy amounts instead of the raw data max.
export function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function shortAmount(value: number): string {
  return Math.round(value).toLocaleString("en-MY");
}

const LINE_CHART_HEIGHT = 220;
export const LINE_CHART_TICKS = 5;
export const LEFT_AXIS_WIDTH = 64;
const PAD_X = 32;
export const PAD_TOP = 24;

// Measures the card's actual width so the chart can space its points to
// fill it exactly, instead of either a fixed pixel width that leaves a big
// empty gap on wide screens, or a CSS-stretched SVG that distorts text.
export function useContainerWidth(fallback: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    setWidth(el.clientWidth || fallback);
    return () => observer.disconnect();
  }, [fallback]);

  return [ref, width];
}

// Two lines per month (target, achieved) with gridlines and a value label
// on every point, drawn as plain SVG rather than pulling in a charting
// library for a handful of points.
export function RevenueTrendChart({ points }: { points: MonthlyTrendPoint[] }) {
  const [containerRef, containerWidth] = useContainerWidth(640);
  const dataMax = Math.max(1, ...points.map((p) => Math.max(p.targetAmount, p.achievedAmount)));
  const axisMax = niceMax(dataMax);

  // No minimum step here — the chart always fills exactly the measured
  // container width, so it never needs a horizontal scrollbar (points just
  // pack closer together on a narrow screen instead).
  const width = Math.max(containerWidth - LEFT_AXIS_WIDTH, 120);
  const step = points.length > 1 ? (width - PAD_X * 2) / (points.length - 1) : width - PAD_X * 2;

  const xAt = (i: number) => PAD_X + i * step;
  const yAt = (value: number) => PAD_TOP + LINE_CHART_HEIGHT - (value / axisMax) * LINE_CHART_HEIGHT;

  const targetPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.targetAmount)}`).join(" ");
  const achievedPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.achievedAmount)}`).join(" ");

  const ticks = Array.from({ length: LINE_CHART_TICKS + 1 }, (_, i) => (axisMax / LINE_CHART_TICKS) * i);

  // Keep value labels clear of both the top edge and the x-axis month
  // labels — a "below" label on a near-zero point would otherwise land
  // right on top of the month text underneath it.
  const plotBottom = PAD_TOP + LINE_CHART_HEIGHT;
  const monthLabelY = plotBottom + 28;
  const labelAbove = (y: number) => Math.max(y - 10, PAD_TOP - 2);
  const labelBelow = (y: number) => Math.min(y + 16, plotBottom - 6);

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
            <span className="w-3 h-[3px] rounded-full bg-red-500 inline-block" /> Achieved
          </span>
        </div>
      </div>
      <div ref={containerRef} className="overflow-x-auto">
        <svg width={width + LEFT_AXIS_WIDTH} height={monthLabelY + 10} className="min-w-full">
          <g transform={`translate(${LEFT_AXIS_WIDTH}, 0)`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={width} y1={yAt(t)} y2={yAt(t)} className="stroke-neutral-100" strokeWidth={1} />
                <text x={-8} y={yAt(t)} dy={3} textAnchor="end" className="fill-neutral-400 text-[10px]">
                  {shortAmount(t)}
                </text>
              </g>
            ))}
            <path d={targetPath} fill="none" strokeWidth={3} className="stroke-neutral-400" />
            <path d={achievedPath} fill="none" strokeWidth={3} className="stroke-red-500" />
            {points.map((p, i) => {
              const targetY = yAt(p.targetAmount);
              const achievedY = yAt(p.achievedAmount);
              const achievedAbove = achievedY <= targetY;
              return (
                <g key={`${p.year}-${p.month}`}>
                  <text
                    x={xAt(i)}
                    y={achievedAbove ? labelBelow(targetY) : labelAbove(targetY)}
                    textAnchor="middle"
                    className="fill-neutral-500 text-[10px] font-medium"
                  >
                    {shortAmount(p.targetAmount)}
                  </text>
                  <text
                    x={xAt(i)}
                    y={achievedAbove ? labelAbove(achievedY) : labelBelow(achievedY)}
                    textAnchor="middle"
                    className="fill-red-600 text-[10px] font-semibold"
                  >
                    {shortAmount(p.achievedAmount)}
                  </text>
                  <text x={xAt(i)} y={monthLabelY} textAnchor="middle" className="fill-neutral-500 text-[10px] font-medium uppercase">
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

const BRANCH_SERIES: { key: Branch; label: string; stroke: string; text: string; dot: string }[] = [
  { key: "kapar", label: "Kapar (HQ)", stroke: "stroke-red-500", text: "fill-red-600", dot: "bg-red-500" },
  { key: "setia_alam", label: "Setia Alam", stroke: "stroke-orange-500", text: "fill-orange-600", dot: "bg-orange-500" },
  { key: "puncak_alam", label: "Puncak Alam", stroke: "stroke-emerald-500", text: "fill-emerald-600", dot: "bg-emerald-500" },
];

// Repair jobs completed per month, one line per branch — same gridline/
// label mechanics as the revenue chart, just three series instead of two.
export function BranchJobsChart({ points }: { points: MonthlyTrendPoint[] }) {
  const [containerRef, containerWidth] = useContainerWidth(640);
  const dataMax = Math.max(1, ...points.flatMap((p) => BRANCH_SERIES.map((s) => p.repairJobsByBranch[s.key])));
  // Small integer counts need at least LINE_CHART_TICKS worth of range, or
  // gridline values round to the same number and the axis shows duplicates.
  const axisMax = Math.max(LINE_CHART_TICKS, niceMax(dataMax));
  const chartHeight = 200;

  const padX = 24;
  const width = Math.max(containerWidth - LEFT_AXIS_WIDTH, 120);
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : width - padX * 2;

  const xAt = (i: number) => padX + i * step;
  const yAt = (value: number) => PAD_TOP + chartHeight - (value / axisMax) * chartHeight;
  const plotBottom = PAD_TOP + chartHeight;
  const monthLabelY = plotBottom + 26;
  const labelAbove = (y: number) => Math.max(y - 10, PAD_TOP - 2);

  const ticks = Array.from({ length: LINE_CHART_TICKS + 1 }, (_, i) => (axisMax / LINE_CHART_TICKS) * i);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex flex-col items-center mb-4 text-center">
        <p className="text-sm font-semibold text-neutral-900">Repair Jobs Completed by Branch</p>
        <p className="text-xs text-neutral-500 mt-0.5">Restore Bike + Jobsheet, last {points.length} months</p>
        <div className="flex items-center gap-4 text-xs text-neutral-500 mt-2">
          {BRANCH_SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={`w-3 h-[3px] rounded-full inline-block ${s.dot}`} /> {s.label}
            </span>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="overflow-x-auto">
        <svg width={width + LEFT_AXIS_WIDTH} height={monthLabelY + 10} className="min-w-full">
          <g transform={`translate(${LEFT_AXIS_WIDTH}, 0)`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={width} y1={yAt(t)} y2={yAt(t)} className="stroke-neutral-100" strokeWidth={1} />
                <text x={-8} y={yAt(t)} dy={3} textAnchor="end" className="fill-neutral-400 text-[10px]">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {BRANCH_SERIES.map((s) => {
              const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.repairJobsByBranch[s.key])}`).join(" ");
              return <path key={s.key} d={path} fill="none" strokeWidth={3} className={s.stroke} />;
            })}
            {points.map((p, i) => (
              <g key={`${p.year}-${p.month}`}>
                {BRANCH_SERIES.map((s) => (
                  <text
                    key={s.key}
                    x={xAt(i)}
                    y={labelAbove(yAt(p.repairJobsByBranch[s.key]))}
                    textAnchor="middle"
                    className={`text-[10px] font-semibold ${s.text}`}
                  >
                    {p.repairJobsByBranch[s.key]}
                  </text>
                ))}
                <text x={xAt(i)} y={monthLabelY} textAnchor="middle" className="fill-neutral-500 text-[10px] font-medium uppercase">
                  {p.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
