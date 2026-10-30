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
      className="group relative overflow-hidden bg-white border rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
    >
      {/* Soft colour wash in the corner, in the card's own colour. */}
      <div
        aria-hidden="true"
        className={`absolute -right-10 -top-10 w-36 h-36 rounded-full blur-2xl opacity-70 transition-transform duration-500 group-hover:scale-125 ${color}`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 ring-inset ring-black/5 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${color}`}
        >
          <Icon size={20} />
        </div>
        <ArrowUpRight
          size={18}
          className="text-neutral-300 transition-all duration-300 group-hover:text-neutral-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </div>
      <p className="relative mt-5 text-3xl font-bold tracking-tight text-neutral-900">
        {typeof value === "number" ? (
          <CountUp value={value} />
        ) : currency !== null ? (
          <CountUp value={currency} kind="currency" />
        ) : (
          value
        )}
      </p>
      <p className="relative text-sm font-medium text-neutral-500 mt-1">{label}</p>
      {detail && <p className="relative text-xs text-neutral-400 mt-0.5">{detail}</p>}
    </Link>
  );
}
