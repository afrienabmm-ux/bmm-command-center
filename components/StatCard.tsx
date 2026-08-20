import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export default function StatCard({
  icon: Icon,
  label,
  value,
  color,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 transition-colors"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${color}`}>
        <Icon size={17} />
      </div>
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
    </Link>
  );
}
