"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  Wrench,
  Wrench as MechanicIcon,
  Smartphone,
  Package,
  Layers,
  UserCog,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  KeyRound,
} from "lucide-react";
import { signOutAction, changeOwnPasswordAction } from "@/lib/auth-actions";
import type { Role } from "@/lib/current-user";
import type { PageKey } from "@/lib/permissions";

const links: { href: string; label: string; icon: typeof LayoutDashboard; page: PageKey | null; color: string }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, page: null, color: "text-indigo-500" },
  { href: "/warranty-claims", label: "Warranty Claims", icon: ShieldCheck, page: "warranty-claims", color: "text-amber-500" },
  { href: "/repairs", label: "Restore Bike", icon: Wrench, page: "repairs", color: "text-sky-500" },
  { href: "/repairs/walk-in", label: "Walk-in", icon: ClipboardList, page: "walk-in", color: "text-purple-500" },
  { href: "/mechanics", label: "Mechanics", icon: MechanicIcon, page: "mechanics", color: "text-emerald-500" },
  { href: "/genblu", label: "GenBlu Tracker", icon: Smartphone, page: "genblu", color: "text-pink-500" },
  { href: "/catalog", label: "Catalog", icon: Package, page: "catalog", color: "text-orange-500" },
  { href: "/packages", label: "Services Combo", icon: Layers, page: "packages", color: "text-teal-500" },
];

const TEAM_LINK_COLOR = "text-rose-500";

export default function Sidebar({
  email,
  name,
  role,
  positionTitle,
  pages,
  collapsed,
  onToggle,
}: {
  email: string;
  name: string;
  role: Role | null;
  positionTitle: string | null;
  pages: PageKey[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const canSeeTeam = role === "Management";
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const visibleLinks = links.filter((l) => l.page === null || pages.includes(l.page));
  const navLinks = canSeeTeam
    ? [...visibleLinks, { href: "/team", label: "Manage Team", icon: UserCog, page: null, color: TEAM_LINK_COLOR }]
    : visibleLinks;

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
              onClick={onToggle}
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
            onClick={onToggle}
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
              <Icon size={17} className={`shrink-0 ${active ? "text-indigo-600" : link.color}`} />
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
            {positionTitle && <p className="text-xs text-neutral-500 mt-0.5 truncate">{positionTitle}</p>}
          </>
        )}
        <button
          type="button"
          onClick={() => setChangePasswordOpen(true)}
          title={collapsed ? "Change password" : undefined}
          className={`flex items-center text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors ${
            collapsed ? "justify-center w-full py-1.5 rounded-lg hover:bg-neutral-100 mt-1" : "gap-1.5 mt-3"
          }`}
        >
          <KeyRound size={collapsed ? 16 : 13} />
          {!collapsed && "Change Password"}
        </button>
        <form action={signOutAction} className={collapsed ? "" : "mt-2"}>
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

      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    </aside>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    startTransition(async () => {
      const result = await changeOwnPasswordAction(currentPassword, newPassword);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setDone(true);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        {done ? (
          <>
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Password changed</h2>
            <p className="text-sm text-neutral-600 mb-6">
              Your password has been updated. Use it next time you sign in.
            </p>
            <div className="flex items-center justify-end">
              <button
                onClick={onClose}
                className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Change password</h2>
            <p className="text-sm text-neutral-600 mb-4">Enter your current password, then choose a new one.</p>
            <div className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min. 8 characters)"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !currentPassword || !newPassword}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
