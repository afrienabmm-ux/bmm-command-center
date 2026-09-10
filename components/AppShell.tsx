"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import BranchSwitcher from "@/components/BranchSwitcher";
import { useToast } from "@/lib/useToast";
import type { Role } from "@/lib/current-user";
import type { PageKey } from "@/lib/permissions";
import type { BranchSelection } from "@/lib/branch";

const STORAGE_KEY = "cc_sidebar_collapsed";

export default function AppShell({
  email,
  name,
  role,
  positionTitle,
  pages,
  activeBranch,
  locked,
  allowAll,
  children,
}: {
  email: string;
  name: string;
  role: Role | null;
  positionTitle: string | null;
  pages: PageKey[];
  activeBranch: BranchSelection;
  locked: boolean;
  allowAll: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showInfo, toastNode } = useToast();
  const welcomedRef = useRef(false);

  // Closes the phone-width drawer automatically on navigation — without
  // this it would stay open over whatever page was just tapped into.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Read the saved preference after mount so the server and client render
  // the same markup on first paint.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  // signInAction tags the post-login redirect with ?welcome=1 — greet the
  // person by name once, then strip the param so refreshing or navigating
  // back doesn't show it again.
  useEffect(() => {
    if (searchParams.get("welcome") !== "1" || welcomedRef.current) return;
    welcomedRef.current = true;
    showInfo(`Welcome, ${name}!`);
    const rest = new URLSearchParams(searchParams);
    rest.delete("welcome");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, name, router, showInfo]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex w-full">
      {toastNode}
      <Sidebar
        email={email}
        name={name}
        role={role}
        positionTitle={positionTitle}
        pages={pages}
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-14 border-b border-neutral-200 flex items-center justify-between gap-3 px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Only ever the way into the sidebar on a phone-width screen —
                from md up the sidebar is always visible inline instead. */}
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:text-red-600 hover:border-red-300 transition-colors shrink-0"
            >
              <Menu size={16} />
            </button>
            {/* Stands in for the sidebar's own logo/name once that's hidden
                — always on a phone screen (sidebar is hidden by default
                there), or on desktop only once collapsed to icons. */}
            <p className={`text-sm font-semibold text-neutral-800 tracking-wide truncate ${collapsed ? "" : "md:hidden"}`}>
              BERJAYA MEGA MOTORS <span className="text-neutral-400 font-normal">— AFTERSALES</span>
            </p>
          </div>
          <BranchSwitcher activeBranch={activeBranch} locked={locked} allowAll={allowAll} />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
