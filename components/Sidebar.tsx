"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  Wrench,
  Wrench as MechanicIcon,
  Smartphone,
  Layers,
  TrendingUp,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  KeyRound,
  Users,
  ChevronDown,
  Eye,
  EyeOff,
  FileBarChart,
} from "lucide-react";
import { signOutAction, changeOwnPasswordAction } from "@/lib/auth-actions";
import type { Role } from "@/lib/current-user";
import type { PageKey } from "@/lib/permissions";

type NavLink = { href: string; label: string; icon: typeof LayoutDashboard; page: PageKey | null; color: string };

// Main links (dashboard through Claims), Manage Team (Management only),
// then the trailing links — kept as two groups so Manage Team can be
// spliced in between them rather than always landing at the very end.
const mainLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, page: "dashboard", color: "text-red-500" },
  { href: "/repairs/walk-in", label: "Jobsheet", icon: ClipboardList, page: "walk-in", color: "text-red-600" },
  { href: "/sales-performance", label: "Sales Performance", icon: TrendingUp, page: "sales-performance", color: "text-sky-500" },
  { href: "/repairs", label: "Restore Bike", icon: Wrench, page: "repairs", color: "text-sky-500" },
  { href: "/packages", label: "Services Combo", icon: Layers, page: "packages", color: "text-teal-500" },
  { href: "/genblu", label: "GenBlu Tracker", icon: Smartphone, page: "genblu", color: "text-pink-500" },
  { href: "/warranty-claims", label: "Claims", icon: ShieldCheck, page: "warranty-claims", color: "text-amber-500" },
  { href: "/customers", label: "Services Card", icon: Users, page: "customers", color: "text-rose-600" },
  { href: "/reports", label: "Reports", icon: FileBarChart, page: "reports", color: "text-indigo-500" },
];

const trailingLinks: NavLink[] = [{ href: "/mechanics", label: "Mechanics", icon: MechanicIcon, page: "mechanics", color: "text-emerald-500" }];

const TEAM_LINK_COLOR = "text-rose-500";

function initials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  const visible = (list: NavLink[]) => list.filter((l) => l.page === null || pages.includes(l.page));
  const navLinks: NavLink[] = [
    ...visible(mainLinks),
    ...visible(trailingLinks),
    ...(canSeeTeam ? [{ href: "/team", label: "Manage Team", icon: UserCog, page: null, color: TEAM_LINK_COLOR }] : []),
  ];

  return (
    <aside
      className={`relative ${collapsed ? "w-16" : "w-64"} shrink-0 bg-neutral-50 border-r border-neutral-200 flex flex-col transition-[width] duration-200`}
    >
      <div
        className={`flex items-center border-b border-neutral-200 ${collapsed ? "h-auto flex-col gap-2.5 px-2 py-4" : "h-16 gap-2.5 px-5"}`}
      >
        <img src="/bmm-logo.png" alt="Berjaya Mega Motors" className="w-8 h-8 rounded-full object-cover shrink-0" />
        {!collapsed && (
          <div className="leading-none min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900">After-Sales</p>
            <p className="text-[11px] text-neutral-500 truncate">Berjaya Mega Motors</p>
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          className="w-6 h-6 flex items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:text-red-600 hover:border-red-300 transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      <div ref={profileRef} className={`relative border-b border-neutral-200 ${collapsed ? "px-2 py-3" : "px-3 py-3"}`}>
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          title={collapsed ? name || email : undefined}
          className={`w-full flex items-center rounded-lg transition-colors hover:bg-neutral-100 ${
            collapsed ? "justify-center py-1.5" : "gap-2.5 px-2 py-1.5"
          }`}
        >
          <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-700 text-xs font-semibold flex items-center justify-center shrink-0">
            {initials(name, email)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left leading-none">
                <p className="text-sm font-medium text-neutral-800 truncate">{name || email}</p>
                <p className="text-xs text-neutral-500 truncate mt-0.5">{positionTitle || role}</p>
              </span>
              <ChevronDown size={14} className={`text-neutral-400 shrink-0 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            </>
          )}
        </button>

        {profileOpen && (
          <div
            className={`absolute z-20 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg py-2 ${
              collapsed ? "left-full ml-2 w-56" : "left-3 right-3"
            }`}
          >
            <div className="px-3.5 py-2 border-b border-neutral-100">
              <p className="text-sm font-medium text-neutral-800 truncate" title={email}>
                {name || email}
              </p>
              <p className="text-xs text-red-600 mt-0.5">{role}</p>
              {positionTitle && <p className="text-xs text-neutral-500 mt-0.5 truncate">{positionTitle}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                setChangePasswordOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800 transition-colors"
            >
              <KeyRound size={14} /> Change Password
            </button>
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800 transition-colors"
              >
                <LogOut size={14} /> Sign out
              </button>
            </form>
          </div>
        )}
      </div>

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
                  ? "bg-red-500/10 text-red-700"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
              }`}
            >
              <Icon size={17} className={`shrink-0 ${active ? "text-red-600" : link.color}`} />
              {!collapsed && link.label}
            </Link>
          );
        })}
      </nav>

      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    </aside>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
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
                className="bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
              <div className="relative">
                <input
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min. 8 characters)"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
                className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
