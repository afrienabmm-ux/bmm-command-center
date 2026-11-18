import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import CountUp from "@/components/CountUp";

// "RM 1,234.50" → 1234.5, so currency figures can count up too.
function parseCurrency(value: string): number | null {
  const m = value.match(/^RM\s*([\d,]+(?:\.\d+)?)$/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  href,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  /** No longer used: cards stay neutral. Kept so existing callers still compile. */
  color?: string;
  href: string;
  detail?: string;
}) {
  const currency = typeof value === "string" ? parseCurrency(value) : null;
  return (
    <Link
      href={href}
      prefetch={false}
      className="group bg-white border border-neutral-200 rounded-xl p-5 transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <p className="flex items-center gap-2 text-sm text-neutral-600">
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-neutral-400" />
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-neutral-900">
        {typeof value === "number" ? (
          <CountUp value={value} />
        ) : currency !== null ? (
          <CountUp value={currency} kind="currency" />
        ) : (
          value
        )}
      </p>
      {detail && <p className="text-xs text-neutral-500 mt-1 tabular-nums">{detail}</p>}
    </Link>
  );
}
