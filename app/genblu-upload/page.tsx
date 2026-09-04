import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requirePage, requirePageContext, getActiveBranchSelection } from "@/lib/current-user";
import GenbluPanel from "../scan/GenbluPanel";
import SavedToast from "../scan/SavedToast";
import { Suspense } from "react";
import { signOutAction } from "@/lib/auth-actions";
import { LogOut } from "lucide-react";

export const dynamic = "force-dynamic";
// The GenBlu screenshot check runs an OCR call (with retries) inside this
// page's server actions — give it more room than the platform default so a
// slow Vision API response doesn't time out mid-save.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "BMM GenBlu Upload",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BMM GenBlu" },
};

// A standalone, sidebar-free page with exactly one job: uploading a GenBlu
// registration/points screenshot. Built for the Sales Advisor access level
// (see lib/permissions.ts) — a sales advisor's only task in this whole
// system is registering GenBlu, so their link skips straight to it instead
// of landing on /scan's jobsheet-first flow they have no use for. Lives
// outside the (app) route group on purpose so it never gets AppShell's
// desktop sidebar.
export default async function GenbluUploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/genblu-upload");

  await requirePage("genblu");
  const { user: currentUser } = await requirePageContext();

  const branchSelection = await getActiveBranchSelection(currentUser);

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-neutral-50 to-neutral-50">
      <Suspense fallback={null}>
        <SavedToast />
      </Suspense>
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200 px-4 py-3 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bmm-logo.png" alt="Berjaya Mega Motors" className="w-7 h-7 rounded-full object-cover shrink-0" />
        <div className="leading-none min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">BMM GenBlu Upload</p>
          <p className="text-[11px] text-neutral-500 truncate">Signed in as {currentUser.name} ({currentUser.email})</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1 text-[11px] font-medium text-neutral-600 hover:text-red-600 border border-neutral-200 rounded-full px-2.5 py-1 shrink-0"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </form>
      </div>
      <div className="p-4">
        <GenbluPanel recentJobs={[]} branchSelection={branchSelection} onlyMode="link" forceNewCustomer />
      </div>
    </div>
  );
}
