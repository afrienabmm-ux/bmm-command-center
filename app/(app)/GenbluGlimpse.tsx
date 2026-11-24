import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { GenbluGlimpse as Data } from "@/lib/genblu-glimpse";


function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-neutral-900">{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">{sub}</p>}
    </div>
  );
}

// "GenBlu this month" on the home dashboard: the same counts as the GenBlu
// page, at a glance.
export default function GenbluGlimpse({ data, isRealToday, monthName }: { data: Data; isRealToday: boolean; monthName: string }) {
  const n = (v: number) => v.toLocaleString("en-MY");
  const maxPoints = Math.max(1, ...data.byBranch.map((b) => b.points));
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-900">GenBlu, {monthName}</p>
        <Link href="/genblu" prefetch={false} className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900">
          Open GenBlu <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        <Figure label="Point allocations" value={n(data.allocations.counts)} sub={`${n(data.allocations.points)} points`} />
        {data.newBike > 0 && <Figure label="New-bike awards" value={n(data.newBike)} sub="100 points each, up to Oct 2026" />}
        <Figure
          label="New sign-ups"
          value={n(data.salesmanSignups + data.adminSignups)}
          sub={`Salesman ${n(data.salesmanSignups)} · Admin ${n(data.adminSignups)}`}
        />
        {isRealToday && <Figure label="Allocations today" value={n(data.today.counts)} sub={`${n(data.today.points)} points`} />}
      </div>
      {data.byBranch.length > 1 && (
        <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2.5">
          {data.byBranch.map((b) => (
            <div key={b.branch} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
              <span className="text-neutral-700">{b.label}</span>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div className="h-full rounded-full bg-red-600" style={{ width: `${(b.points / maxPoints) * 100}%` }} />
              </div>
              <span className="text-neutral-600 tabular-nums whitespace-nowrap">
                {n(b.counts)} · {n(b.points)} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
