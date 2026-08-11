"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  Wrench,
  Wrench as MechanicIcon,
  Smartphone,
  Package,
  Layers,
  BarChart3,
  UserCog,
  LogOut,
} from "lucide-react";
import { signOutAction } from "@/lib/auth-actions";
import type { Role } from "@/lib/current-user";
import type { PageKey } from "@/lib/permissions";

const links: { href: string; label: string; icon: typeof LayoutDashboard; page: PageKey | null }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, page: null },
  { href: "/warranty-claims", label: "Warranty Claims", icon: ShieldCheck, page: "warranty-claims" },
  { href: "/repairs", label: "Workshop Repairs", icon: Wrench, page: "repairs" },
  { href: "/mechanics", label: "Mechanics", icon: MechanicIcon, page: "mechanics" },
  { href: "/genblu", label: "GenBlu Registration", icon: Smartphone, page: "genblu" },
  { href: "/catalog", label: "Catalog", icon: Package, page: "catalog" },
  { href: "/packages", label: "Main Packages", icon: Layers, page: "packages" },
  { href: "/reports", label: "Reports", icon: BarChart3, page: "reports" },
];

export default function Sidebar({
  email,
  name,
  role,
  pages,
}: {
  email: string;
  name: string;
  role: Role | null;
  pages: PageKey[];
}) {
  const pathname = usePathname();
  const canSeeTeam = role === "Manager" || role === "IT";

  const visibleLinks = links.filter((l) => l.page === null || pages.includes(l.page));
  const navLinks = canSeeTeam ? [...visibleLinks, { href: "/team", label: "Team", icon: UserCog, page: null }] : visibleLinks;

  return (
    <aside className="w-64 shrink-0 bg-neutral-50 border-r border-neutral-200 flex flex-col">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-neutral-200">
        <img src="/bmm-logo.png" alt="Berjaya Mega Motors" className="w-8 h-8 rounded-full object-cover shrink-0" />
        <div className="leading-none">
          <p className="text-sm font-semibold text-neutral-900">After-Sales</p>
          <p className="text-[11px] text-neutral-500">Berjaya Mega Motors</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-500/10 text-indigo-700"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
              }`}
            >
              <Icon size={17} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-neutral-200">
        <p className="text-xs text-neutral-500">Signed in as</p>
        <p className="text-sm text-neutral-700 font-medium truncate" title={email}>
          {name || email}
        </p>
        <p className="text-xs text-indigo-600 mt-0.5">{role}</p>
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
