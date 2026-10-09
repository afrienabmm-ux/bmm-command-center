"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
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
        {/* Stays pinned to the top on a phone so the branch is always in
            reach while scrolling a long list. */}
        <div className="sticky top-0 z-30 md:static h-14 bg-white/95 backdrop-blur md:bg-transparent md:backdrop-blur-none border-b border-neutral-200 flex items-center justify-between gap-3 px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Phone: the bottom bar's "More" opens the menu, so the top
                just shows who we are. */}
            <img src="/bmm-logo.png" alt="" className="md:hidden w-7 h-7 object-contain shrink-0" />
            <p className="md:hidden text-sm font-semibold text-neutral-800 truncate">After-Sales</p>
            {/* Desktop: stands in for the sidebar's own logo/name once it's
                collapsed to icons. */}
            <p className={`hidden text-sm font-semibold text-neutral-800 tracking-wide truncate ${collapsed ? "md:block" : ""}`}>
              BERJAYA MEGA MOTORS <span className="text-neutral-400 font-normal">— AFTERSALES</span>
            </p>
          </div>
          <BranchSwitcher activeBranch={activeBranch} locked={locked} allowAll={allowAll} />
        </div>
        {/* Room at the bottom on a phone so the tab bar never covers the
            last row of a page. */}
        <main className="flex-1 min-w-0 pb-24 md:pb-0">{children}</main>
      </div>
      <MobileTabBar pages={pages} onMore={() => setMobileNavOpen(true)} />
    </div>
  );
}
