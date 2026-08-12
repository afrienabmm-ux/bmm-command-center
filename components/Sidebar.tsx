"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { signOutAction } from "@/lib/auth-actions";
import type { Role } from "@/lib/current-user";
import type { PageKey } from "@/lib/permissions";

const STORAGE_KEY = "cc_sidebar_collapsed";

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
  const [collapsed, setCollapsed] = useState(false);

  // Read the saved preference after mount so the server and client render
  // the same markup on first paint.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  const visibleLinks = links.filter((l) => l.page === null || pages.includes(l.page));
  const navLinks = canSeeTeam ? [...visibleLinks, { href: "/team", label: "Team", icon: UserCog, page: null }] : visibleLinks;

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-64"} shrink-0 bg-neutral-50 border-r border-neutral-200 flex flex-col transition-[width] duration-200`}
    >
      <div
        className={`h-16 flex items-center border-b border-neutral-200 ${collapsed ? "justify-center px-2" : "gap-2.5 px-5"}`}
      >
        <img src="/bmm-logo.png" alt="Berjaya Mega Motors" className="w-8 h-8 rounded-full object-cover shrink-0" />
        {!collapsed && (
          <>
            <div className="leading-none min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">After-Sales</p>
              <p className="text-[11px] text-neutral-500 truncate">Berjaya Mega Motors</p>
            </div>
            <button
              onClick={toggle}
              title="Collapse menu"
              aria-label="Collapse menu"
              className="text-neutral-400 hover:text-neutral-700 transition-colors p-1 shrink-0"
            >
              <PanelLeftClose size={17} />
            </button>
          </>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center pt-3">
          <button
            onClick={toggle}
            title="Expand menu"
            aria-label="Expand menu"
            className="text-neutral-400 hover:text-neutral-700 transition-colors p-1.5 rounded-lg hover:bg-neutral-100"
          >
            <PanelLeftOpen size={17} />
          </button>
        </div>
      )}

      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${collapsed ? "px-2" : "px-3"}`}>
        {navLinks.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-indigo-500/10 text-indigo-700"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && link.label}
            </Link>
          );
        })}
      </nav>

      <div className={`py-4 border-t border-neutral-200 ${collapsed ? "px-2" : "px-5"}`}>
        {!collapsed && (
          <>
            <p className="text-xs text-neutral-500">Signed in as</p>
            <p className="text-sm text-neutral-700 font-medium truncate" title={email}>
              {name || email}
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">{role}</p>
          </>
        )}
        <form action={signOutAction} className={collapsed ? "" : "mt-3"}>
          <button
            type="submit"
            title={collapsed ? `Sign out (${name || email})` : undefined}
            className={`flex items-center text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors ${
              collapsed ? "justify-center w-full py-1.5 rounded-lg hover:bg-neutral-100" : "gap-1.5"
            }`}
          >
            <LogOut size={collapsed ? 16 : 13} />
            {!collapsed && "Sign out"}
          </button>
        </form>
      </div>
    </aside>
  );
}
