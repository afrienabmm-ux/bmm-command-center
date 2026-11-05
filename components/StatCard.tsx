import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
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
  color,
  href,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
  href: string;
  detail?: string;
}) {
  const currency = typeof value === "string" ? parseCurrency(value) : null;
  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative bg-white border border-neutral-200 rounded-2xl p-5 transition-colors duration-200 hover:border-neutral-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <ArrowUpRight
          size={18}
          aria-hidden="true"
          className="text-neutral-300 transition-colors duration-200 group-hover:text-neutral-700"
        />
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-neutral-900">
        {typeof value === "number" ? (
          <CountUp value={value} />
        ) : currency !== null ? (
          <CountUp value={currency} kind="currency" />
        ) : (
          value
        )}
      </p>
      <p className="text-sm font-medium text-neutral-600 mt-1">{label}</p>
      {detail && <p className="text-xs text-neutral-500 mt-0.5">{detail}</p>}
    </Link>
  );
}
