"use server";

import { requireApproved } from "./current-user";
import { getBranchMonthSummary, getMechanicAchievements } from "./reports-actions";
import { getPackageSales, getAllBranchesPackageSales } from "./packages-actions";
import { getActiveRepairJobs, getCompletedRepairJobs } from "./repairs-actions";
import { getMechanics } from "./mechanics-actions";
import { getWarrantyClaims } from "./claims-actions";
import { getGenbluRegistrations, getAllBranchesGenbluRegistrations } from "./genblu-actions";
import { toCsv, monthLabel, formatDate, daysBetween } from "./format";
import { BRANCHES, branchLabel, type Branch } from "./branch";
import type { JobType, ClaimStatus } from "./types";

export async function exportYearlySummaryCsv(branch: Branch, year: number): Promise<string> {
  await requireApproved();
  const rows: (string | number)[][] = [];
  for (let month = 1; month <= 12; month++) {
    const summary = await getBranchMonthSummary(branch, year, month);
    rows.push([monthLabel(month, year), summary.targetAmount.toFixed(2), summary.achievedAmount.toFixed(2)]);
  }
  return toCsv(["Month", "Target (RM)", "Achieved (RM)"], rows);
}

export async function exportMechanicReportCsv(branch: Branch, year: number, month: number): Promise<string> {
  await requireApproved();
  const achievements = await getMechanicAchievements(branch, year, month);
  const rows = achievements.map((a) => [
    a.fullName,
    a.shortCode,
    a.restoreBikeCount,
    a.restoreBikeRevenue.toFixed(2),
    a.walkInCount,
    a.walkInRevenue.toFixed(2),
    a.totalRevenue.toFixed(2),
  ]);
  return toCsv(
    [
      "Mechanic",
      "Code",
      "Restore Bike Jobs",
      "Restore Bike Revenue (RM)",
      "Walk-in Jobs",
      "Walk-in Revenue (RM)",
      "Total Revenue (RM)",
    ],
    rows
  );
}

export async function exportAllBranchesMechanicReportCsv(year: number, month: number): Promise<string> {
  await requireApproved();
  const rows: (string | number)[][] = [];
  for (const { value: branch } of BRANCHES) {
    const achievements = await getMechanicAchievements(branch, year, month);
    for (const a of achievements) {
      rows.push([
        branchLabel(branch),
        a.fullName,
        a.shortCode,
        a.restoreBikeCount,
        a.restoreBikeRevenue.toFixed(2),
        a.walkInCount,
        a.walkInRevenue.toFixed(2),
        a.totalRevenue.toFixed(2),
      ]);
    }
  }
  return toCsv(
    [
      "Branch",
      "Mechanic",
      "Code",
      "Restore Bike Jobs",
      "Restore Bike Revenue (RM)",
      "Walk-in Jobs",
      "Walk-in Revenue (RM)",
      "Total Revenue (RM)",
    ],
    rows
  );
}

export async function exportPackageSalesCsv(branch: Branch): Promise<string> {
  await requireApproved();
  const sales = await getPackageSales(branch);
  const rows = sales.map((s) => [s.receiptId, s.packageName, s.mechanicCode, formatDate(s.saleDate)]);
  return toCsv(["Receipt ID", "Package Name", "Mechanic", "Date"], rows);
}

export async function exportAllBranchesPackageSalesCsv(): Promise<string> {
  await requireApproved();
  const sales = await getAllBranchesPackageSales();
  const rows = sales.map((s) => [s.receiptId, s.packageName, s.mechanicCode, branchLabel(s.branch), formatDate(s.saleDate)]);
  return toCsv(["Receipt ID", "Package Name", "Mechanic", "Branch", "Date"], rows);
}

export async function exportRepairJobsCsv(branch: Branch, jobType?: JobType): Promise<string> {
  await requireApproved();
  const [active, completed] = await Promise.all([getActiveRepairJobs(branch), getCompletedRepairJobs(branch)]);
  const today = new Date().toISOString().slice(0, 10);
  const all = [...active, ...completed];
  const filtered = jobType ? all.filter((j) => j.jobType === jobType) : all;

  if (jobType === "Restore Bike") {
    const mechanics = await getMechanics(branch);
    const mechanicLabel = (id: string | null) => {
      const m = id ? mechanics.find((m) => m.id === id) : null;
      return m ? `${m.shortName} (${m.shortCode})` : "";
    };
    const rows = filtered.map((j, i) => [
      i + 1,
      j.picName,
      j.plateNo,
      j.model,
      j.bikeYear,
      j.condition,
      mechanicLabel(j.mechanicId),
      j.location,
      formatDate(j.startedDate),
      j.completedDate ? formatDate(j.completedDate) : "",
      j.revenueAmount.toFixed(2),
      j.description,
      j.dealType,
      j.status,
    ]);
    return toCsv(
      [
        "No.",
        "PIC",
        "N. Plate",
        "Model",
        "Tahun",
        "Condition",
        "Mechanic",
        "Location",
        "Start Date",
        "End Date",
        "Cost Restore (RM)",
        "Remark",
        "Trade In / Jual",
        "Status",
      ],
      rows
    );
  }

  const rows = filtered.map((j) => [
    j.jobNo,
    j.customerName,
    j.plateNo,
    j.jobType,
    j.status,
    j.revenueAmount.toFixed(2),
    j.dealType,
    formatDate(j.startedDate),
    j.completedDate ? formatDate(j.completedDate) : "",
    daysBetween(j.startedDate, j.completedDate ?? today) ?? 0,
  ]);
  return toCsv(
    [
      "Job No",
      "Customer",
      "Plate No",
      "Job Type",
      "Status",
      "Cost Total (RM)",
      "Trade-in/Sell",
      "Started Date",
      "Completed Date",
      "Days Taken",
    ],
    rows
  );
}

export async function exportWarrantyClaimsCsv(branch: Branch, status?: ClaimStatus): Promise<string> {
  await requireApproved();
  const claims = await getWarrantyClaims(branch);
  const filtered = status ? claims.filter((c) => c.status === status) : claims;
  const rows = filtered.map((c) => [
    c.ticketId,
    c.customerName,
    c.plateNo,
    c.model,
    c.phone,
    c.description,
    c.stockStatus,
    c.status,
    formatDate(c.submittedDate),
  ]);
  return toCsv(
    ["Ticket ID", "Customer", "Plate No", "Model", "Phone", "Issue", "Stock Status", "Status", "Submitted Date"],
    rows
  );
}

export async function exportGenbluCsv(branch: Branch, fromDate?: string, toDate?: string): Promise<string> {
  await requireApproved();
  const registrations = await getGenbluRegistrations(branch);
  const filtered = registrations.filter((r) => {
    const day = r.createdAt.slice(0, 10);
    if (fromDate && day < fromDate) return false;
    if (toDate && day > toDate) return false;
    return true;
  });
  const rows = filtered.map((r) => [
    r.salespersonName,
    r.salespersonCode,
    r.customerPlateNo,
    formatDate(r.createdAt),
  ]);
  return toCsv(["Salesperson", "Code", "Customer Plate No", "Date"], rows);
}

export async function exportAllBranchesGenbluCsv(fromDate?: string, toDate?: string): Promise<string> {
  await requireApproved();
  const registrations = await getAllBranchesGenbluRegistrations();
  const filtered = registrations.filter((r) => {
    const day = r.createdAt.slice(0, 10);
    if (fromDate && day < fromDate) return false;
    if (toDate && day > toDate) return false;
    return true;
  });
  const rows = filtered.map((r) => [
    r.salespersonName,
    r.salespersonCode,
    r.customerPlateNo,
    branchLabel(r.branch),
    formatDate(r.createdAt),
  ]);
  return toCsv(["Salesperson", "Code", "Customer Plate No", "Branch", "Date"], rows);
}
