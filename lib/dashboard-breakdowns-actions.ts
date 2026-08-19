"use server";

import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import { CLAIM_STATUSES, type ClaimStatus } from "./types";
import { BRANCHES, type Branch } from "./branch";

function monthRange(year: number, month: number): { from: string; to: string } {
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${year}-${monthStr}-01`, to: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}` };
}

export type ClaimStatusBreakdownRow = { status: ClaimStatus; count: number };

// All branches combined, scoped to the same month as the rest of the
// dashboard — every status is included even at zero so the legend never
// silently drops a category the moment nothing's in it this month.
export async function getWarrantyClaimStatusBreakdown(year: number, month: number): Promise<ClaimStatusBreakdownRow[]> {
  await requireApproved();
  const { from, to } = monthRange(year, month);
  const { data, error } = await supabaseAdmin
    .from("cc_warranty_claims")
    .select("status")
    .gte("submitted_date", from)
    .lte("submitted_date", to);
  if (error) throw new Error(error.message);

  const counts = new Map<ClaimStatus, number>(CLAIM_STATUSES.map((s) => [s, 0]));
  for (const row of data ?? []) {
    const status = row.status as ClaimStatus;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return CLAIM_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

export type PackageBreakdownRow = { name: string; count: number };

type PackageSaleRow = { branch: Branch; cc_packages: { name: string } | null };

// Which Services Combo package actually sold, not just how many total —
// grouped by package name, broken out per branch (not combined) so each
// branch's own mix is visible, same month as the rest of the dashboard.
export async function getPackageSalesBreakdown(year: number, month: number): Promise<Record<Branch, PackageBreakdownRow[]>> {
  await requireApproved();
  const { from, to } = monthRange(year, month);
  const { data, error } = await supabaseAdmin
    .from("cc_package_sales")
    .select("branch, cc_packages(name)")
    .gte("sale_date", from)
    .lte("sale_date", to);
  if (error) throw new Error(error.message);

  const typedRows = (data ?? []) as unknown as PackageSaleRow[];
  return BRANCHES.reduce(
    (acc, { value: branch }) => {
      const counts = new Map<string, number>();
      for (const row of typedRows) {
        if (row.branch !== branch) continue;
        const name = row.cc_packages?.name ?? "Unknown";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      acc[branch] = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      return acc;
    },
    {} as Record<Branch, PackageBreakdownRow[]>
  );
}
