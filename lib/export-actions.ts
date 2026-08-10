"use server";

import { requireApproved } from "./current-user";
import { getBranchMonthSummary, getMechanicAchievements } from "./reports-actions";
import { getPackageSales } from "./packages-actions";
import { getActiveRepairJobs, getCompletedRepairJobs } from "./repairs-actions";
import { toCsv, monthLabel, formatDate, daysBetween } from "./format";
import type { Branch } from "./branch";
import type { JobType } from "./types";

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

export async function exportPackageSalesCsv(branch: Branch): Promise<string> {
  await requireApproved();
  const sales = await getPackageSales(branch);
  const rows = sales.map((s) => [s.receiptId, s.packageName, s.mechanicCode, formatDate(s.saleDate)]);
  return toCsv(["Receipt ID", "Package Name", "Mechanic", "Date"], rows);
}

export async function exportRepairJobsCsv(branch: Branch, jobType?: JobType): Promise<string> {
  await requireApproved();
  const [active, completed] = await Promise.all([getActiveRepairJobs(branch), getCompletedRepairJobs(branch)]);
  const today = new Date().toISOString().slice(0, 10);
  const all = [...active, ...completed];
  const filtered = jobType ? all.filter((j) => j.jobType === jobType) : all;
  const rows = filtered.map((j) => [
    j.jobNo,
    j.customerName,
    j.plateNo,
    j.jobType,
    j.status,
    j.revenueAmount.toFixed(2),
    formatDate(j.startedDate),
    j.completedDate ? formatDate(j.completedDate) : "",
    daysBetween(j.startedDate, j.completedDate ?? today) ?? 0,
  ]);
  return toCsv(
    ["Job No", "Customer", "Plate No", "Job Type", "Status", "Revenue (RM)", "Started Date", "Completed Date", "Days Taken"],
    rows
  );
}
