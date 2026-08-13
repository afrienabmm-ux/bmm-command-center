"use server";

import { requireApproved } from "./current-user";
import { getPackageSales, getAllBranchesPackageSales } from "./packages-actions";
import { getGenbluRegistrations, getAllBranchesGenbluRegistrations } from "./genblu-actions";
import { toCsv, formatDate } from "./format";
import { branchLabel, type Branch } from "./branch";

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
