import Link from "next/link";
import { ClipboardList, Wrench, Users, Smartphone, ShieldCheck, Truck, Wrench as MechanicIcon, TrendingUp, History } from "lucide-react";
import { requirePage, requireApproved } from "@/lib/current-user";
import { canViewLogs } from "@/lib/logs-access";
import { SCOPED_REPORT_SLUGS } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

type ReportCard = {
  slug: string;
  title: string;
  description: string;
  icon: typeof ClipboardList;
  color: string;
  category: string;
};

// A flat list rather than grid-per-category — grouping into separate grids
// forced every category's row to stop at exactly 2 cards regardless of
// screen width, leaving a wide gap next to them on anything wider than a
// laptop. One continuous grid lets cards actually fill each row; the
// category still shows, just as a small label on the card instead of a
// row-breaking header.
const CARDS: ReportCard[] = [
  { slug: "jobsheet", title: "Jobsheet", description: "Every Walk-in job, active and completed.", icon: ClipboardList, color: "text-red-600 bg-red-500/10", category: "Repairs" },
  { slug: "restore-bike", title: "Restore Bike", description: "Every Restore Bike job, all stages.", icon: Wrench, color: "text-sky-600 bg-sky-500/10", category: "Repairs" },
  { slug: "services-card", title: "Services Card", description: "Customer spend, visits, and loyalty cards.", icon: Users, color: "text-rose-600 bg-rose-500/10", category: "Customer" },
  { slug: "genblu", title: "GenBlu Tracker", description: "GenBlu registrations and points awarded.", icon: Smartphone, color: "text-pink-600 bg-pink-500/10", category: "Customer" },
  { slug: "point-allocation", title: "Point Allocation", description: "Every GenBlu points transaction logged, with monthly counts.", icon: Smartphone, color: "text-fuchsia-600 bg-fuchsia-500/10", category: "Customer" },
  { slug: "warranty-claims", title: "Warranty Claims", description: "Every warranty claim and its status.", icon: ShieldCheck, color: "text-amber-600 bg-amber-500/10", category: "Claims" },
  { slug: "delivery-claims", title: "Delivery Claims", description: "Every delivery claim and its status.", icon: Truck, color: "text-orange-600 bg-orange-500/10", category: "Claims" },
  { slug: "mechanics", title: "Mechanics", description: "The mechanic roster across every branch.", icon: MechanicIcon, color: "text-emerald-600 bg-emerald-500/10", category: "Team" },
  { slug: "sales-performance", title: "Sales Performance", description: "Monthly revenue per mechanic, last 12 months.", icon: TrendingUp, color: "text-indigo-600 bg-indigo-500/10", category: "Team" },
];

export default async function ReportsPage() {
  await requirePage("reports");
  const user = await requireApproved();
  // Front Desk gets a cut-down Reports page — just the report types their
  // own work touches — instead of the full admin list. See
  // SCOPED_REPORT_SLUGS in lib/permissions.ts.
  const scopedSlugs = user.role ? SCOPED_REPORT_SLUGS[user.role] : undefined;
  const showLogs = !scopedSlugs && canViewLogs(user.email);
  const visibleCards = scopedSlugs ? CARDS.filter((c) => scopedSlugs.includes(c.slug)) : CARDS;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Reports"
        subtitle="Search, filter, and export any of these records."
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {showLogs && (
            <Link
              href="/reports/logs"
              className="bg-white border border-neutral-200 rounded-xl p-6 hover:border-red-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-neutral-700 bg-neutral-500/10">
                  <History size={22} />
                </div>
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mt-1.5">Admin</span>
              </div>
              <p className="text-base font-semibold text-neutral-900">Logs</p>
              <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">Who logged in and every team-management action.</p>
            </Link>
          )}
          {visibleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.slug}
                href={`/reports/${card.slug}`}
                className="bg-white border border-neutral-200 rounded-xl p-6 hover:border-red-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.color}`}>
                    <Icon size={22} />
                  </div>
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mt-1.5">{card.category}</span>
                </div>
                <p className="text-base font-semibold text-neutral-900">{card.title}</p>
                <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
