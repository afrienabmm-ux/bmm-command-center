import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage, getActiveBranchSelection } from "@/lib/current-user";
import PageHeader from "@/components/PageHeader";
import ReportTable, { type ReportColumn } from "@/components/ReportTable";
import { branchLabel } from "@/lib/branch";
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
import { getGenbluRegistrations, getAllBranchesGenbluRegistrations } from "@/lib/genblu-actions";
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
  const selection = await getActiveBranchSelection(user);
  const allBranches = selection === "all";

  let columns: ReportColumn[] = [];
  let rows: Record<string, string | number>[] = [];
  let dateField: string | undefined;
  let monthField: string | undefined;
  let searchFields: string[] = [];

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
  } else if (type === "services-card") {
    const customers = allBranches ? await getAllBranchesCustomers() : await getCustomers(selection);
    columns = [
      { key: "name", label: "Customer" },
      { key: "branch", label: "Branch" },
      { key: "plates", label: "Plates" },
      { key: "jobCount", label: "Visits" },
      { key: "totalSpend", label: "Total Spend (RM)" },
      { key: "lastVisit", label: "Last Visit" },
      { key: "cardNumber", label: "Card No" },
    ];
    dateField = "lastVisit";
    searchFields = ["name", "plates", "cardNumber"];
    rows = customers.map((c) => ({
      name: c.name,
      branch: branchLabel(c.branch),
      plates: c.plates.join(", "),
      jobCount: c.jobCount,
      totalSpend: c.totalSpend.toFixed(2),
      lastVisit: c.lastVisit || "",
      cardNumber: c.card?.cardNumber ?? "—",
    }));
  } else if (type === "genblu") {
    const regs = allBranches ? await getAllBranchesGenbluRegistrations() : await getGenbluRegistrations(selection);
    columns = [
      { key: "customerName", label: "Customer" },
      { key: "branch", label: "Branch" },
      { key: "customerPlateNo", label: "Plate No" },
      { key: "salespersonName", label: "Salesperson" },
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
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    const monthRows: {
      label: string;
      rows: { fullName: string; shortCode: string; restoreBikeRevenue: number; walkInRevenue: number; packageRevenue: number; totalRevenue: number }[];
    }[] = [];
    for (let i = 0; i < 12; i++) {
      const perf = allBranches ? await getAllBranchesPerformance(year, month) : await getBranchPerformance(selection, year, month);
      monthRows.push({
        label: new Date(year, month - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        rows: perf,
      });
      const rolled = rollBackMonth(year, month);
      year = rolled.year;
      month = rolled.month;
    }
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
        <ReportTable
          columns={columns}
          rows={rows}
          dateField={dateField}
          monthField={monthField}
          searchFields={searchFields}
          searchPlaceholder="Search…"
          filename={`bmm-report-${type}`}
        />
      </div>
    </div>
  );
}
