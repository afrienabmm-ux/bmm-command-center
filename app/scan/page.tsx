import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requirePage,
  requirePageContext,
  getActiveBranchSelection,
  canViewAllBranches,
  hasPageAccess,
} from "@/lib/current-user";
import { getAllBranchesActiveRepairJobs, getAllBranchesCompletedRepairJobs, getRepairJobById } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { getAllCatalogProducts } from "@/lib/catalog-actions";
import { getPackages } from "@/lib/packages-actions";
import WalkInJobForm from "../(app)/repairs/walk-in/WalkInJobForm";
import GenbluQuickForm, { type RecentJobsheetCustomer } from "./GenbluQuickForm";
import JobsheetPicker from "./JobsheetPicker";
import ScanTabs from "./ScanTabs";
import SavedToast from "./SavedToast";

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
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/scan");

  await requirePage("walk-in");
  const { user: currentUser } = await requirePageContext();
  const { job: jobId } = await searchParams;
  const locked = !canViewAllBranches(currentUser);
  const [branchSelection, allActiveJobs, completedJobs, mechanics, catalogProducts, packages, editingJob] = await Promise.all([
    getActiveBranchSelection(currentUser),
    getAllBranchesActiveRepairJobs(),
    getAllBranchesCompletedRepairJobs(),
    getAllMechanics(),
    getAllCatalogProducts(),
    getPackages(),
    jobId ? getRepairJobById(jobId) : null,
  ]);

  // Any active Walk-in job without an End Date yet is a candidate to pick
  // here — this is what lets a PIC set the End Date from their phone and
  // have it show up on the dashboard's Jobsheet list immediately, without
  // needing to re-type the whole job.
  const openJobsheets = allActiveJobs
    .filter((j) => j.jobType === "Walk-in" && !j.completedDate && (!locked || j.branch === currentUser.homeBranch))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((j) => ({ id: j.id, jobNo: j.jobNo, customerName: j.customerName, plateNo: j.plateNo }));

  const jobsheetForm = (
    <div>
      <JobsheetPicker jobs={openJobsheets} selectedId={jobId} />
      <WalkInJobForm
        key={jobId ?? "new"}
        job={editingJob ?? null}
        branchSelection={branchSelection}
        locked={locked}
        mechanics={mechanics}
        allActiveJobs={allActiveJobs}
        catalogProducts={catalogProducts}
        packages={packages}
        preferCamera
        redirectTo="/scan"
      />
    </div>
  );

  const canUploadGenblu = hasPageAccess(currentUser, "genblu");

  // Most recent Walk-in jobs (active or completed) are what a GenBlu
  // screenshot actually gets attached to — the whole point of this tab is
  // reusing whatever the jobsheet already has on file, not asking again.
  const recentJobs: RecentJobsheetCustomer[] = [...allActiveJobs, ...completedJobs]
    .filter((j) => j.jobType === "Walk-in" && (!locked || j.branch === currentUser.homeBranch))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25)
    .map((j) => ({ jobId: j.id, branch: j.branch, customerName: j.customerName, customerPlateNo: j.plateNo, date: j.createdAt }));

  return (
    <div className="min-h-screen bg-neutral-50">
      <Suspense fallback={null}>
        <SavedToast />
      </Suspense>
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
          <ScanTabs jobsheet={jobsheetForm} genblu={<GenbluQuickForm recentJobs={recentJobs} />} />
        ) : (
          jobsheetForm
        )}
      </div>
    </div>
  );
}
