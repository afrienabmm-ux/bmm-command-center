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

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={radius - 2} className="fill-neutral-100" />
      </svg>
    );
  }

  if (nonZero.length === 1) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={radius - 2} className={nonZero[0].colorClass} />
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
    );
  }

  let angle = -90;
  return (
    <svg width={size} height={size}>
      {slices.map((s) => {
        if (s.value === 0) return null;
        const fraction = s.value / total;
        const startAngle = angle;
        const endAngle = angle + fraction * 360;
        angle = endAngle;
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
            <path d={d} className={s.colorClass} stroke="white" strokeWidth={1} />
            {pct >= 8 && (
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
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
