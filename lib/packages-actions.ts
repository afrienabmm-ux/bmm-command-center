"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import { BRANCHES, type Branch } from "./branch";
import type { Package } from "./types";

type PackageRow = { id: string; name: string; price: number; spec: string; description: string; created_at: string };

function toPackage(r: PackageRow): Package {
  return { id: r.id, name: r.name, price: Number(r.price), spec: r.spec, description: r.description, createdAt: r.created_at };
}

export async function getPackages(): Promise<Package[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin.from("cc_packages").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return (data as PackageRow[]).map(toPackage);
}

export async function addPackageAction(input: {
  name: string;
  price: number;
  spec: string;
  description: string;
}): Promise<void> {
  await requireApproved();
  const { error } = await supabaseAdmin.from("cc_packages").insert({
    name: input.name,
    price: input.price,
    spec: input.spec,
    description: input.description,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/packages");
}

export async function deletePackageAction(id: string): Promise<void> {
  await requireApproved();
  const { error } = await supabaseAdmin.from("cc_packages").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/packages");
}

type SaleRow = {
  id: string;
  branch: Branch;
  package_id: string;
  mechanic_id: string | null;
  receipt_id: string;
  sale_date: string;
  cc_packages: { name: string } | null;
  cc_mechanics: { short_code: string; short_name: string } | null;
};

export type PackageSaleWithNames = {
  id: string;
  branch: Branch;
  packageId: string;
  packageName: string;
  mechanicId: string | null;
  mechanicCode: string;
  receiptId: string;
  saleDate: string;
};

function toSale(r: SaleRow): PackageSaleWithNames {
  return {
    id: r.id,
    branch: r.branch,
    packageId: r.package_id,
    packageName: r.cc_packages?.name ?? "—",
    mechanicId: r.mechanic_id,
    mechanicCode: r.cc_mechanics?.short_code ?? "—",
    receiptId: r.receipt_id,
    saleDate: r.sale_date,
  };
}

export async function getPackageSales(branch: Branch): Promise<PackageSaleWithNames[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_package_sales")
    .select("*, cc_packages(name), cc_mechanics(short_code, short_name)")
    .eq("branch", branch)
    .order("sale_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as SaleRow[]).map(toSale);
}

export async function getPackageSoldCounts(branch: Branch): Promise<Record<string, number>> {
  await requireApproved();
  const { data, error } = await supabaseAdmin.from("cc_package_sales").select("package_id").eq("branch", branch);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.package_id] = (counts[row.package_id] ?? 0) + 1;
  }
  return counts;
}

// Same as getPackageSales, but merged across all 3 branches for the
// "All Branches" combined view.
export async function getAllBranchesPackageSales(): Promise<PackageSaleWithNames[]> {
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getPackageSales(value)));
  return perBranch.flat().sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));
}

export async function getAllBranchesPackageSoldCounts(): Promise<Record<string, number>> {
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getPackageSoldCounts(value)));
  const counts: Record<string, number> = {};
  for (const branchCounts of perBranch) {
    for (const [packageId, count] of Object.entries(branchCounts)) {
      counts[packageId] = (counts[packageId] ?? 0) + count;
    }
  }
  return counts;
}

export async function addPackageSaleAction(input: {
  branch: Branch;
  packageId: string;
  mechanicId: string | null;
  receiptId: string;
  saleDate: string;
}): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const { error } = await supabaseAdmin.from("cc_package_sales").insert({
    branch: input.branch,
    package_id: input.packageId,
    mechanic_id: input.mechanicId,
    receipt_id: input.receiptId,
    sale_date: input.saleDate,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/packages");
  revalidatePath("/reports");
}

export async function deletePackageSaleAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_package_sales").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/packages");
  revalidatePath("/reports");
}
