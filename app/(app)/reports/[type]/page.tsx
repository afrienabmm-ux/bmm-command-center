import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage, getActiveBranchSelection } from "@/lib/current-user";
import { SCOPED_REPORT_SLUGS } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import ReportTable, { type ReportColumn } from "@/components/ReportTable";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import {
  getActiveRepairJobs,
  getAllBranchesActiveRepairJobs,
  getCompletedRepairJobs,
  getAllBranchesCompletedRepairJobs,
  getQcRepairJobs,
  getAllBranchesQcRepairJobs,
} from "@/lib/repairs-actions";
import { getMechanics, getAllMechanics } from "@/lib/mechanics-actions";
import { getCustomers, getAllBranchesCustomers } from "@/lib/customers-actions";
import {
  getGenbluRegistrations,
  getAllBranchesGenbluRegistrations,
  getGenbluTransactions,
  getAllBranchesGenbluTransactions,
  getGenbluMonthlySummary,
  getScreenshotUrl,
} from "@/lib/genblu-actions";
import { todayInMalaysia, startOfWeekInMalaysia, endOfWeekInMalaysia } from "@/lib/malaysia-time";
import { formatShortDate, monthLabel } from "@/lib/format";
import GenbluMonthlySummary from "../../genblu/GenbluMonthlySummary";
import JobsheetRevenueSummary from "./JobsheetRevenueSummary";
import { getWarrantyClaims, getAllBranchesWarrantyClaims } from "@/lib/claims-actions";
import { getDeliveryClaims, getAllBranchesDeliveryClaims } from "@/lib/delivery-claims-actions";
import { getAllBranchesPerformance, getBranchPerformance } from "@/lib/reports-actions";
import type { RepairJob, Mechanic } from "@/lib/types";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  jobsheet: "Jobsheet",
  "restore-bike": "Restore Bike",
  "services-card": "Services Card",
  genblu: "GenBlu Tracker",
  "point-allocation": "Point Allocation",
  "warranty-claims": "Warranty Claims",
  "delivery-claims": "Delivery Claims",
  mechanics: "Mechanics",
  "sales-performance": "Sales Performance",
};

function mechanicLabel(mechanics: Mechanic[], id: string | null): string {
  if (!id) return "—";
  const m = mechanics.find((x) => x.id === id);
  return m ? `${m.shortName} (${m.shortCode})` : "—";
}

function rollBackMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export default async function ReportDetailPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!TITLES[type]) notFound();

  const user = await requirePage("reports");
  // Some narrow roles' Reports index only ever links to a few cards, but
  // nothing stops someone typing another report's URL directly — same
  // scoping enforced here too, not just by hiding the card on the index
  // page. See SCOPED_REPORT_SLUGS in lib/permissions.ts.
  const scopedSlugs = user.role ? SCOPED_REPORT_SLUGS[user.role] : undefined;
  if (scopedSlugs && !scopedSlugs.includes(type)) {
    redirect("/reports");
  }
  const selection = await getActiveBranchSelection(user);
  const allBranches = selection === "all";

  let columns: ReportColumn[] = [];
  let rows: Record<string, string | number>[] = [];
  let dateField: string | undefined;
  let monthField: string | undefined;
  let searchFields: string[] = [];
  let imageField: string | undefined;
  // Point Allocation only — this month's counts/points by branch, kept in
  // its own table next to the full transaction list rather than folded
  // into the same rows, same split the GenBlu page itself uses.
  let monthlySummary: Awaited<ReturnType<typeof getGenbluMonthlySummary>> | undefined;
  // Stitched onto the front of the CSV export alongside the transaction
  // rows — same numbers shown in the summary table(s) beside it (Point
  // Allocation's per-branch counts, Jobsheet's revenue by week/month),
  // just also captured when someone exports the report.
  let summarySections: { title: string; columns: string[]; rows: (string | number)[][] }[] | undefined;
  // Jobsheet only — revenue totalled by week, by month, and (on the
  // combined All Branches view) by branch — shown next to the transaction
  // list the same way Point Allocation's summary is.
  let revenueSummary:
    | {
        weeks: { label: string; total: number; byBranch?: Record<string, number> }[];
        months: { label: string; total: number; byBranch?: Record<string, number> }[];
        branches?: { label: string; jobs: number; revenue: number }[];
        branchColumns?: { key: string; label: string }[];
      }
    | undefined;

  if (type === "jobsheet" || type === "restore-bike") {
    const jobType = type === "jobsheet" ? "Walk-in" : "Restore Bike";
    const [active, completed, qc, mechanics] = await Promise.all([
      allBranches ? getAllBranchesActiveRepairJobs() : getActiveRepairJobs(selection),
      allBranches ? getAllBranchesCompletedRepairJobs() : getCompletedRepairJobs(selection),
      allBranches ? getAllBranchesQcRepairJobs() : getQcRepairJobs(selection),
      getAllMechanics(),
    ]);
    const jobs: RepairJob[] = [...active, ...completed, ...qc].filter((j) => j.jobType === jobType);

    columns = [
      { key: "jobNo", label: "Job No" },
      { key: "branch", label: "Branch" },
      { key: "customerName", label: "Customer" },
      { key: "plateNo", label: "Plate No" },
      { key: "model", label: "Model" },
      { key: "mechanic", label: "Mechanic" },
      { key: "revenue", label: "Cost Total (RM)" },
      { key: "jobDate", label: "Job Date" },
      { key: "completedDate", label: "Completed Date" },
      { key: "status", label: "Status" },
    ];
    dateField = "jobDate";
    searchFields = ["jobNo", "customerName", "plateNo", "mechanic"];
    rows = jobs.map((j) => ({
      jobNo: j.jobNo,
      branch: branchLabel(j.branch),
      customerName: j.customerName || j.picName || "—",
      plateNo: j.plateNo,
      model: j.model || "—",
      mechanic: mechanicLabel(mechanics, j.mechanicId),
      revenue: j.revenueAmount.toFixed(2),
      jobDate: j.formDate || j.startedDate || "",
      completedDate: j.completedDate || "",
      status: j.status,
    }));

    if (type === "jobsheet") {
      // Keyed by week-start/month, each holding a running total per branch
      // plus "all" for the combined figure — one pass over the jobs either
      // way, whether or not the per-branch columns end up shown.
      const weekTotals = new Map<string, Record<string, number>>();
      const monthTotals = new Map<string, Record<string, number>>();
      function addTo(map: Map<string, Record<string, number>>, key: string, branch: Branch, amount: number) {
        const entry = map.get(key) ?? {};
        entry[branch] = (entry[branch] ?? 0) + amount;
        entry.all = (entry.all ?? 0) + amount;
        map.set(key, entry);
      }
      for (const j of jobs) {
        const date = j.formDate || j.startedDate;
        if (!date) continue;
        addTo(weekTotals, startOfWeekInMalaysia(date), j.branch, j.revenueAmount);
        addTo(monthTotals, date.slice(0, 7), j.branch, j.revenueAmount);
      }
      // Branch breakdown only makes sense on the combined view — a
      // single-branch selection only ever has the one branch anyway.
      const branchList = allBranches ? BRANCHES.map((b) => b.value) : undefined;
      const weeks = [...weekTotals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, byBranch]) => ({
          label: `${formatShortDate(weekStart)} – ${formatShortDate(endOfWeekInMalaysia(weekStart))}`,
          total: byBranch.all ?? 0,
          byBranch: branchList ? Object.fromEntries(branchList.map((b) => [b, byBranch[b] ?? 0])) : undefined,
        }));
      const months = [...monthTotals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, byBranch]) => {
          const [y, m] = key.split("-").map(Number);
          return {
            label: monthLabel(m, y),
            total: byBranch.all ?? 0,
            byBranch: branchList ? Object.fromEntries(branchList.map((b) => [b, byBranch[b] ?? 0])) : undefined,
          };
        });

      let branches: { label: string; jobs: number; revenue: number }[] | undefined;
      if (allBranches) {
        const perBranch = new Map<string, { jobs: number; revenue: number }>();
        for (const b of BRANCHES) perBranch.set(b.value, { jobs: 0, revenue: 0 });
        for (const j of jobs) {
          const entry = perBranch.get(j.branch);
          if (!entry) continue;
          entry.jobs += 1;
          entry.revenue += j.revenueAmount;
        }
        branches = BRANCHES.map((b) => {
          const entry = perBranch.get(b.value)!;
          return { label: branchLabel(b.value), jobs: entry.jobs, revenue: entry.revenue };
        });
        branches.push({
          label: "All Branches",
          jobs: jobs.length,
          revenue: jobs.reduce((sum, j) => sum + j.revenueAmount, 0),
        });
      }

      const branchColumns = branchList?.map((b) => ({ key: b, label: branchLabel(b) }));
      revenueSummary = { weeks, months, branches, branchColumns };
      const branchColumnLabels = branchColumns?.map((b) => b.label) ?? [];
      summarySections = [
        {
          title: "Jobsheet Revenue by Week",
          columns: ["Week", ...branchColumnLabels, "Total (RM)"],
          rows: weeks.map((w) => [w.label, ...(branchList ?? []).map((b) => (w.byBranch?.[b] ?? 0).toFixed(2)), w.total.toFixed(2)]),
        },
        {
          title: "Jobsheet Revenue by Month",
          columns: ["Month", ...branchColumnLabels, "Total (RM)"],
          rows: months.map((m) => [m.label, ...(branchList ?? []).map((b) => (m.byBranch?.[b] ?? 0).toFixed(2)), m.total.toFixed(2)]),
        },
        ...(branches
          ? [{ title: "Jobsheet Summary by Branch", columns: ["Branch", "Jobs", "Revenue (RM)"], rows: branches.map((b) => [b.label, b.jobs, b.revenue.toFixed(2)]) }]
          : []),
      ];
    }
  } else if (type === "services-card") {
    const cards = allBranches ? await getAllBranchesCustomers() : await getCustomers(selection);
    columns = [
      { key: "name", label: "Customer" },
      { key: "branch", label: "Branch" },
      { key: "phone", label: "Phone" },
      { key: "plate", label: "Plate No" },
      { key: "stamps", label: "Stamps" },
      { key: "cardNumber", label: "Card No" },
      { key: "issuedDate", label: "Issued" },
    ];
    dateField = "issuedDate";
    searchFields = ["name", "plate", "cardNumber"];
    rows = cards.map((c) => ({
      name: c.customerName,
      branch: branchLabel(c.branch),
      phone: c.customerPhone,
      plate: c.plateNo,
      stamps: `${c.stamps.length}/10`,
      cardNumber: c.cardNumber,
      issuedDate: c.issuedDate || "",
    }));
  } else if (type === "genblu") {
    const regs = allBranches ? await getAllBranchesGenbluRegistrations() : await getGenbluRegistrations(selection);
    columns = [
      { key: "customerName", label: "Customer" },
      { key: "branch", label: "Branch" },
      { key: "customerPlateNo", label: "Plate No" },
      { key: "salespersonName", label: "Upload By" },
      { key: "pointsAccrued", label: "Points" },
      { key: "createdAt", label: "Registered On" },
    ];
    dateField = "createdAt";
    searchFields = ["customerName", "customerPlateNo", "salespersonName"];
    rows = regs.map((r) => ({
      customerName: r.customerName,
      branch: branchLabel(r.branch),
      customerPlateNo: r.customerPlateNo,
      salespersonName: r.salespersonName,
      pointsAccrued: r.pointsAccrued ?? "—",
      createdAt: r.createdAt.slice(0, 10),
    }));
  } else if (type === "point-allocation") {
    const [todayYear, todayMonth] = todayInMalaysia().split("-").map(Number);
    monthlySummary = await getGenbluMonthlySummary(todayYear, todayMonth);
    summarySections = [
      {
        title: "Monthly Point Allocation Summary",
        columns: ["Branch", "Counts", "Points"],
        rows: [
          ...monthlySummary.rows.map((r) => [r.label, r.counts, r.points]),
          [monthlySummary.total.label, monthlySummary.total.counts, monthlySummary.total.points],
        ],
      },
    ];
    const txns = allBranches ? await getAllBranchesGenbluTransactions() : await getGenbluTransactions(selection);
    // Signed URLs, one per row's uploaded screenshot — fetched up front so
    // double-clicking a row opens it with no extra round trip.
    const screenshotUrls = await Promise.all(
      txns.map((t) => (t.screenshotPath ? getScreenshotUrl(t.screenshotPath) : Promise.resolve(null)))
    );
    columns = [
      { key: "transactionDate", label: "Transaction Date" },
      { key: "transactionTime", label: "Time" },
      { key: "points", label: "Points" },
      { key: "productCategory", label: "Category" },
      { key: "customerName", label: "Customer Name" },
      { key: "serviceCoupon", label: "Service Coupon" },
      { key: "branch", label: "Branch" },
    ];
    dateField = "transactionDate";
    searchFields = ["customerName"];
    imageField = "screenshotUrl";
    rows = txns.map((t, i) => ({
      transactionDate: t.transactionDate ?? "",
      transactionTime: t.transactionTime ?? "—",
      points: t.points,
      productCategory: t.productCategory ?? "—",
      customerName: t.customerName,
      serviceCoupon: t.serviceCoupon ? "Yes" : "No",
      branch: branchLabel(t.branch),
      screenshotUrl: screenshotUrls[i] ?? "",
    }));
  } else if (type === "warranty-claims" || type === "delivery-claims") {
    const isWarranty = type === "warranty-claims";
    const claims = isWarranty
      ? allBranches
        ? await getAllBranchesWarrantyClaims()
        : await getWarrantyClaims(selection)
      : allBranches
        ? await getAllBranchesDeliveryClaims()
        : await getDeliveryClaims(selection);
    columns = [
      { key: "ticketId", label: "Ticket ID" },
      { key: "branch", label: "Branch" },
      ...(isWarranty ? [{ key: "customerName", label: "Customer" }] : [{ key: "pic", label: "PIC" }]),
      { key: "plateNo", label: "Plate No" },
      { key: "model", label: "Model" },
      { key: "status", label: "Status" },
      { key: "submittedDate", label: "Submitted Date" },
    ];
    dateField = "submittedDate";
    searchFields = isWarranty ? ["ticketId", "customerName", "plateNo"] : ["ticketId", "pic", "plateNo"];
    rows = claims.map((c) => ({
      ticketId: c.ticketId,
      branch: branchLabel(c.branch),
      ...(isWarranty ? { customerName: (c as { customerName: string }).customerName } : { pic: (c as { pic: string }).pic }),
      plateNo: c.plateNo,
      model: c.model,
      status: c.status,
      submittedDate: c.submittedDate || "",
    }));
  } else if (type === "mechanics") {
    const mechanics = allBranches ? await getAllMechanics() : await getMechanics(selection);
    columns = [
      { key: "shortName", label: "Name" },
      { key: "shortCode", label: "Code" },
      { key: "branch", label: "Branch" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
    ];
    searchFields = ["shortName", "shortCode"];
    rows = mechanics.map((m) => ({
      shortName: m.shortName,
      shortCode: m.shortCode,
      branch: branchLabel(m.branch),
      category: m.category,
      status: m.status,
    }));
  } else if (type === "sales-performance") {
    let [year, month] = todayInMalaysia().split("-").map(Number);
    const periods: { year: number; month: number }[] = [];
    for (let i = 0; i < 12; i++) {
      periods.push({ year, month });
      const rolled = rollBackMonth(year, month);
      year = rolled.year;
      month = rolled.month;
    }
    // All 12 months fetched at once instead of one-by-one — the sequential
    // version made every render wait out 12 round trips back to back.
    const monthRows = await Promise.all(
      periods.map(async (p) => ({
        label: new Date(p.year, p.month - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        rows: allBranches ? await getAllBranchesPerformance(p.year, p.month) : await getBranchPerformance(selection, p.year, p.month),
      }))
    );
    columns = [
      { key: "month", label: "Month" },
      { key: "fullName", label: "Mechanic" },
      { key: "shortCode", label: "Code" },
      { key: "restoreBikeRevenue", label: "Restore Bike (RM)" },
      { key: "walkInRevenue", label: "Walk-in (RM)" },
      { key: "packageRevenue", label: "Services Combo (RM)" },
      { key: "totalRevenue", label: "Total (RM)" },
    ];
    monthField = "month";
    searchFields = ["fullName", "shortCode"];
    rows = monthRows.flatMap((m) =>
      m.rows.map((r) => ({
        month: m.label,
        fullName: r.fullName,
        shortCode: r.shortCode,
        restoreBikeRevenue: r.restoreBikeRevenue.toFixed(2),
        walkInRevenue: r.walkInRevenue.toFixed(2),
        packageRevenue: r.packageRevenue.toFixed(2),
        totalRevenue: r.totalRevenue.toFixed(2),
      }))
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={TITLES[type]}
        subtitle={allBranches ? "All branches" : branchLabel(selection)}
        action={
          <Link href="/reports" className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-800">
            <ArrowLeft size={15} /> All Reports
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        {monthlySummary || revenueSummary ? (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="shrink-0 w-full lg:w-auto">
              {monthlySummary && <GenbluMonthlySummary summary={monthlySummary} />}
              {revenueSummary && (
                <JobsheetRevenueSummary
                  weeks={revenueSummary.weeks}
                  months={revenueSummary.months}
                  branches={revenueSummary.branches}
                  branchColumns={revenueSummary.branchColumns}
                />
              )}
            </div>
            <div className="flex-1 min-w-0 w-full">
              <ReportTable
                columns={columns}
                rows={rows}
                dateField={dateField}
                monthField={monthField}
                searchFields={searchFields}
                searchPlaceholder="Search…"
                imageField={imageField}
                filename={`bmm-report-${type}`}
                summarySections={summarySections}
              />
            </div>
          </div>
        ) : (
          <ReportTable
            columns={columns}
            rows={rows}
            dateField={dateField}
            monthField={monthField}
            searchFields={searchFields}
            searchPlaceholder="Search…"
            imageField={imageField}
            filename={`bmm-report-${type}`}
          />
        )}
      </div>
    </div>
  );
}
