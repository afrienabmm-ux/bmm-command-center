"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showInfo, toastNode } = useToast();
  const welcomedRef = useRef(false);

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
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-14 border-b border-neutral-200 flex items-center justify-between px-8 shrink-0">
          {collapsed ? (
            <p className="text-sm font-semibold text-neutral-800 tracking-wide">
              BERJAYA MEGA MOTORS <span className="text-neutral-400 font-normal">— AFTERSALES</span>
            </p>
          ) : (
            <span />
          )}
          <BranchSwitcher activeBranch={activeBranch} locked={locked} allowAll={allowAll} />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
