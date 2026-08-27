import Link from "next/link";
import { ClipboardList, Wrench, Users, Smartphone, ShieldCheck, Truck, Wrench as MechanicIcon, TrendingUp } from "lucide-react";
import { requirePage } from "@/lib/current-user";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

type ReportCard = { slug: string; title: string; description: string; icon: typeof ClipboardList; color: string };

const SECTIONS: { title: string; cards: ReportCard[] }[] = [
  {
    title: "Repairs Reports",
    cards: [
      { slug: "jobsheet", title: "Jobsheet", description: "Every Walk-in job, active and completed.", icon: ClipboardList, color: "text-red-600 bg-red-500/10" },
      { slug: "restore-bike", title: "Restore Bike", description: "Every Restore Bike job, all stages.", icon: Wrench, color: "text-sky-600 bg-sky-500/10" },
    ],
  },
  {
    title: "Customer Reports",
    cards: [
      { slug: "services-card", title: "Services Card", description: "Customer spend, visits, and loyalty cards.", icon: Users, color: "text-rose-600 bg-rose-500/10" },
      { slug: "genblu", title: "GenBlu Tracker", description: "GenBlu registrations and points awarded.", icon: Smartphone, color: "text-pink-600 bg-pink-500/10" },
    ],
  },
  {
    title: "Claims Reports",
    cards: [
      { slug: "warranty-claims", title: "Warranty Claims", description: "Every warranty claim and its status.", icon: ShieldCheck, color: "text-amber-600 bg-amber-500/10" },
      { slug: "delivery-claims", title: "Delivery Claims", description: "Every delivery claim and its status.", icon: Truck, color: "text-orange-600 bg-orange-500/10" },
    ],
  },
  {
    title: "Team Reports",
    cards: [
      { slug: "mechanics", title: "Mechanics", description: "The mechanic roster across every branch.", icon: MechanicIcon, color: "text-emerald-600 bg-emerald-500/10" },
      { slug: "sales-performance", title: "Sales Performance", description: "Monthly revenue per mechanic, last 12 months.", icon: TrendingUp, color: "text-indigo-600 bg-indigo-500/10" },
    ],
  },
];

export default async function ReportsPage() {
  await requirePage("reports");

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Reports" subtitle="Search, filter, and export any of these records." />
      <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-2xl">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">{section.title}</p>
            <div className="grid grid-cols-2 gap-4">
              {section.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.slug}
                    href={`/reports/${card.slug}`}
                    className="bg-white border border-neutral-200 rounded-xl p-5 hover:border-red-300 hover:shadow-sm transition-all"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
                      <Icon size={18} />
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">{card.title}</p>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{card.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
