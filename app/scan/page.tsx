import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requirePage,
  requirePageContext,
  getActiveBranchSelection,
  canViewAllBranches,
  hasPageAccess,
} from "@/lib/current-user";
import { getAllBranchesActiveRepairJobs } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { getAllCatalogProducts } from "@/lib/catalog-actions";
import WalkInJobForm from "../(app)/repairs/walk-in/WalkInJobForm";
import GenbluQuickForm from "./GenbluQuickForm";
import ScanTabs from "./ScanTabs";

export const dynamic = "force-dynamic";
// The GenBlu screenshot check runs an OCR call (with retries) inside this
// page's server actions — give it more room than the platform default so a
// slow Vision API response doesn't time out mid-save.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "BMM Field Upload",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BMM Upload" },
};

// A standalone, sidebar-free page for the two things staff actually need
// to do from a phone in the field: scan a jobsheet, and upload a GenBlu
// points screenshot. Lives outside the (app) route group on purpose so it
// never gets AppShell's desktop sidebar, and ships with manifest.ts so it
// can be added to a phone's home screen as its own shortcut — the main
// dashboard is untouched by any of this.
export default async function ScanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await requirePage("walk-in");
  const { user: currentUser, branch } = await requirePageContext();
  const [branchSelection, allActiveJobs, mechanics, catalogProducts] = await Promise.all([
    getActiveBranchSelection(currentUser),
    getAllBranchesActiveRepairJobs(),
    getAllMechanics(),
    getAllCatalogProducts(),
  ]);

  const jobsheetForm = (
    <WalkInJobForm
      job={null}
      branchSelection={branchSelection}
      locked={!canViewAllBranches(currentUser)}
      mechanics={mechanics}
      allActiveJobs={allActiveJobs}
      catalogProducts={catalogProducts}
      preferCamera
    />
  );

  const canUploadGenblu = hasPageAccess(currentUser, "genblu");

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bmm-logo.png" alt="Berjaya Mega Motors" className="w-7 h-7 rounded-full object-cover shrink-0" />
        <div className="leading-none min-w-0">
          <p className="text-sm font-semibold text-neutral-900">BMM Field Upload</p>
          <p className="text-[11px] text-neutral-500 truncate">Berjaya Mega Motors — After-Sales</p>
        </div>
      </div>
      <div className="p-4">
        {canUploadGenblu ? (
          <ScanTabs
            jobsheet={jobsheetForm}
            genblu={<GenbluQuickForm branch={branch} locked={!canViewAllBranches(currentUser)} mechanics={mechanics} />}
          />
        ) : (
          jobsheetForm
        )}
      </div>
    </div>
  );
}
