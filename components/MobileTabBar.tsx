"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, ScanLine, Smartphone, Menu } from "lucide-react";
import type { PageKey } from "@/lib/permissions";

type Tab = { href: string; label: string; icon: typeof LayoutDashboard; page: PageKey; primary?: boolean };

// The pages staff open most from a phone, one tap away at the bottom of the
// screen like any phone app. Everything else lives behind "More" (the full
// menu). Hidden from md up, where the sidebar is always visible.
const TABS: Tab[] = [
  { href: "/", label: "Home", icon: LayoutDashboard, page: "dashboard" },
  { href: "/repairs/walk-in", label: "Jobsheet", icon: ClipboardList, page: "walk-in" },
  { href: "/scan", label: "Scan", icon: ScanLine, page: "walk-in", primary: true },
  { href: "/genblu", label: "GenBlu", icon: Smartphone, page: "genblu" },
];

export default function MobileTabBar({ pages, onMore }: { pages: PageKey[]; onMore: () => void }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => pages.includes(t.page));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-neutral-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around h-16">
        {tabs.map(({ href, label, icon: Icon, primary }) => {
          const active = isActive(href);
          if (primary) {
            return (
              <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center gap-0.5">
                <span className="w-11 h-11 -mt-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 ring-4 ring-white">
                  <Icon size={20} />
                </span>
                <span className="text-[11px] font-medium text-neutral-700">{label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                active ? "text-red-600" : "text-neutral-500"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-neutral-500"
        >
          <Menu size={20} />
          More
        </button>
      </div>
    </nav>
  );
}
