"use client";

import { useState } from "react";

export type PieSlice = { label: string; value: number; colorClass: string; dot: string };

function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

// Plain SVG pie — no charting library, same approach as the rest of the
// dashboard's charts. A single non-zero slice is drawn as a plain circle
// since a 360° arc path (same start/end point) doesn't render.
function PieChart({ slices, size = 148 }: { slices: PieSlice[]; size?: number }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2;
  const cx = radius;
  const cy = radius;
  const nonZero = slices.filter((s) => s.value > 0);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredSlice = slices.find((s) => s.label === hovered);
  // Small box in the middle of the pie naming the slice under the mouse.
  const hoverBox = hoveredSlice && (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-neutral-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap text-center">
      <p className="font-semibold">{hoveredSlice.label}</p>
      <p>
        {hoveredSlice.value} ({Math.round((hoveredSlice.value / (total || 1)) * 100)}%)
      </p>
    </div>
  );

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={radius - 2} className="fill-neutral-100" />
      </svg>
    );
  }

  if (nonZero.length === 1) {
    return (
      <div className="relative">
      <svg width={size} height={size}>
        <circle
          cx={cx}
          cy={cy}
          r={radius - 2}
          className={`${nonZero[0].colorClass} cursor-pointer`}
          onMouseEnter={() => setHovered(nonZero[0].label)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => setHovered(hovered ? null : nonZero[0].label)}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-white text-[11px] font-semibold"
          style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.25)", strokeWidth: 2 }}
        >
          100%
        </text>
      </svg>
      {hoverBox}
      </div>
    );
  }

  // Each wedge's start angle is derived from the slices before it rather
  // than from a running total carried between iterations, so rendering
  // stays free of any mutation. Re-summing the preceding slices is O(n²),
  // which is nothing at the handful of slices a pie chart ever holds.
  const visible = slices.filter((s) => s.value !== 0);
  const wedges = visible.map((s, i) => {
    const fraction = s.value / total;
    const startAngle = visible.slice(0, i).reduce((deg, prev) => deg + (prev.value / total) * 360, -90);
    return { slice: s, fraction, startAngle, endAngle: startAngle + fraction * 360 };
  });

  return (
    <div className="relative">
    <svg width={size} height={size}>
      {wedges.map(({ slice: s, fraction, startAngle, endAngle }) => {
        const large = endAngle - startAngle > 180 ? 1 : 0;
        const [sx, sy] = pointOnCircle(cx, cy, radius - 2, startAngle);
        const [ex, ey] = pointOnCircle(cx, cy, radius - 2, endAngle);
        const d = `M${cx},${cy} L${sx},${sy} A${radius - 2},${radius - 2} 0 ${large} 1 ${ex},${ey} Z`;
        const pct = Math.round(fraction * 100);
        // Small slices can't fit a legible label without it spilling into
        // the next wedge, so it's left off below a rough 8% cutoff.
        const [labelX, labelY] = pointOnCircle(cx, cy, radius * 0.62, (startAngle + endAngle) / 2);
        return (
          <g key={s.label}>
            <path
              d={d}
              className={`${s.colorClass} cursor-pointer transition-opacity`}
              stroke="white"
              strokeWidth={1}
              opacity={hovered && hovered !== s.label ? 0.55 : 1}
              onMouseEnter={() => setHovered(s.label)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setHovered(hovered === s.label ? null : s.label)}
            />
            {pct >= 8 && (
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
                className="fill-white text-[11px] font-semibold"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.25)", strokeWidth: 2 }}
              >
                {pct}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
    {hoverBox}
    </div>
  );
}

// The pie + legend, without a heading or card wrapper — reused as-is by
// PieChartCard below, and by cards that need a custom header (e.g. a type
// toggle) instead of a plain heading/subtitle pair.
export function PieChartBody({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <p className="text-sm text-neutral-500 text-center py-8">No data yet this month.</p>;
  }
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <PieChart slices={slices} />
      <div className="flex flex-col gap-2 min-w-[140px]">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-neutral-600">
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${s.dot}`} />
              {s.label}
            </span>
            <span className="font-medium text-neutral-900">
              {s.value} <span className="text-neutral-400 font-normal">({Math.round((s.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PieChartCard({ heading, subtitle, slices }: { heading: string; subtitle: string; slices: PieSlice[] }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-neutral-900">{heading}</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-4">{subtitle}</p>
      <PieChartBody slices={slices} />
    </div>
  );
}
