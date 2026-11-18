"use client";

function format(value: number, kind: "currency" | "int" | "percent"): string {
  if (kind === "currency") {
    return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const rounded = Math.round(value).toLocaleString("en-MY");
  return kind === "percent" ? `${rounded}%` : rounded;
}

// Formats a figure the same way everywhere (RM 1,234.50 / 1,234 / 49%).
// It used to count up from zero on every page load; now the real number is
// shown straight away.
export default function CountUp({
  value,
  kind = "int",
  className,
}: {
  value: number;
  kind?: "currency" | "int" | "percent";
  className?: string;
}) {
  return <span className={`tabular-nums ${className ?? ""}`}>{format(value, kind)}</span>;
}
