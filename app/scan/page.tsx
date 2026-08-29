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
import {
  getAllBranchesActiveRepairJobs,
  getAllBranchesCompletedRepairJobs,
  getActiveRepairJobs,
  getCompletedRepairJobs,
  getRepairJobById,
} from "@/lib/repairs-actions";
import { getAllMechanics, getMechanics } from "@/lib/mechanics-actions";
import type { Branch } from "@/lib/branch";
import { getAllCatalogProducts } from "@/lib/catalog-actions";
import { getPackages } from "@/lib/packages-actions";
import WalkInJobForm from "../(app)/repairs/walk-in/WalkInJobForm";
import GenbluPanel from "./GenbluPanel";
import type { RecentJobsheetCustomer } from "./GenbluQuickForm";
import JobsheetPicker from "./JobsheetPicker";
import ScanTabs from "./ScanTabs";
import SavedToast from "./SavedToast";
import { signOutAction } from "@/lib/auth-actions";
import { LogOut } from "lucide-react";

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
  // Locked to one branch (true for basically every Mechanic/Front Desk/
  // Branch PIC login) — fetching every branch's jobs and mechanics just to
  // filter it back down to one on the very next lines was real, unnecessary
  // database load on every single phone-page visit. Only Management/
  // Administrator opening this page still needs the all-branches version.
  const ownBranch = locked ? (currentUser.homeBranch as Branch) : null;
  const [branchSelection, allActiveJobs, completedJobs, mechanics, catalogProducts, packages, editingJob] = await Promise.all([
    getActiveBranchSelection(currentUser),
    ownBranch ? getActiveRepairJobs(ownBranch) : getAllBranchesActiveRepairJobs(),
    ownBranch ? getCompletedRepairJobs(ownBranch) : getAllBranchesCompletedRepairJobs(),
    ownBranch ? getMechanics(ownBranch) : getAllMechanics(),
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
        redirectTo="/scan"
        variant="scan"
      />
    </div>
  );

  // The shared Field Scanner link (see middleware.ts) is jobsheet scanning
  // only — no GenBlu tab, so field staff with just this link have exactly
  // one thing they can do here. Staff on their own account still get both.
  const isFieldScanner = currentUser.email === process.env.FIELD_SCANNER_EMAIL;
  const canUploadGenblu = !isFieldScanner && hasPageAccess(currentUser, "genblu");
  // Front Desk can see Jobsheet on desktop but never add/edit one — so the
  // phone page skips straight to GenBlu (their actual task) instead of
  // offering the jobsheet-scanning tab at all.
  const canScanJobsheet = currentUser.role !== "Front Desk";

  // Most recent Walk-in jobs (active or completed) — lets the GenBlu form
  // offer picking the customer's name off a known jobsheet instead of
  // trusting OCR's read of the screenshot alone.
  const recentJobs: RecentJobsheetCustomer[] = [...allActiveJobs, ...completedJobs]
    .filter((j) => j.jobType === "Walk-in" && (!locked || j.branch === currentUser.homeBranch))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25)
    .map((j) => ({ jobId: j.id, branch: j.branch, customerName: j.customerName, customerPlateNo: j.plateNo, date: j.createdAt }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-neutral-50 to-neutral-50">
      <Suspense fallback={null}>
        <SavedToast />
      </Suspense>
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200 px-4 py-3 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bmm-logo.png" alt="Berjaya Mega Motors" className="w-7 h-7 rounded-full object-cover shrink-0" />
        <div className="leading-none min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">BMM Field Upload</p>
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
        {canScanJobsheet && canUploadGenblu ? (
          <ScanTabs
            jobsheet={jobsheetForm}
            genblu={
              <GenbluPanel
                recentJobs={recentJobs}
                branchSelection={branchSelection}
                defaultMode={currentUser.role === "Mechanic" ? "link" : "log"}
              />
            }
          />
        ) : canUploadGenblu ? (
          <GenbluPanel
            recentJobs={recentJobs}
            branchSelection={branchSelection}
            defaultMode={currentUser.role === "Mechanic" ? "link" : "log"}
          />
        ) : (
          jobsheetForm
        )}
      </div>
    </div>
  );
}
