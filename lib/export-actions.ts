"use server";

import { requireApproved } from "./current-user";
import { getPackageSales, getAllBranchesPackageSales } from "./packages-actions";
import { toCsv, formatDate } from "./format";
import { branchLabel, type Branch } from "./branch";

export async function exportPackageSalesCsv(branch: Branch): Promise<string> {
  await requireApproved();
  const sales = await getPackageSales(branch);
  const rows = sales.map((s) => [s.receiptId ?? "", s.packageName, s.comboType, s.mechanicCode, formatDate(s.saleDate)]);
  return toCsv(["Receipt ID", "Package Name", "Type", "Mechanic", "Date"], rows);
}

export async function exportAllBranchesPackageSalesCsv(): Promise<string> {
  await requireApproved();
  const sales = await getAllBranchesPackageSales();
  const rows = sales.map((s) => [s.receiptId ?? "", s.packageName, s.comboType, s.mechanicCode, branchLabel(s.branch), formatDate(s.saleDate)]);
  return toCsv(["Receipt ID", "Package Name", "Type", "Mechanic", "Branch", "Date"], rows);
}


