"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// useLayoutEffect warns during server rendering; this falls back to
// useEffect there (where it never runs anyway).
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const DURATION_MS = 1400;

function format(value: number, kind: "currency" | "int" | "percent"): string {
  if (kind === "currency") {
    return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const rounded = Math.round(value).toLocaleString("en-MY");
  return kind === "percent" ? `${rounded}%` : rounded;
}

// A number that counts up from zero when the page opens. The server renders
// the final figure (so it's right even before scripts load); it's reset to
// zero just before the first paint, then rolls up to the real value.
export default function CountUp({
  value,
  kind = "int",
  className,
}: {
  value: number;
  kind?: "currency" | "int" | "percent";
  className?: string;
}) {
  const [shown, setShown] = useState(value);

  useIsoLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={`tabular-nums ${className ?? ""}`}>{format(shown, kind)}</span>;
}
