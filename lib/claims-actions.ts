"use server";

import { revalidatePath, updateTag, unstable_cache } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { WarrantyClaim, ClaimStatus, StockStatus, BikeMake } from "./types";
import { BRANCHES, type Branch } from "./branch";
import { logActivity } from "./activity-log";

type Row = {
  id: string;
  branch: Branch;
  claim_no: string;
  customer_name: string;
  plate_no: string;
  model: string;
  phone: string;
  description: string;
  stock_status: StockStatus;
  bike_make: BikeMake;
  status: ClaimStatus;
  submitted_date: string;
  created_at: string;
  pic: string;
  latest_status: string;
  reason: string;
};

function toClaim(r: Row): WarrantyClaim {
  return {
    id: r.id,
    branch: r.branch,
    ticketId: r.claim_no,
    customerName: r.customer_name,
    plateNo: r.plate_no,
    model: r.model,
    phone: r.phone,
    description: r.description,
    stockStatus: r.stock_status,
    bikeMake: r.bike_make ?? "Yamaha",
    status: r.status,
    submittedDate: r.submitted_date,
    createdAt: r.created_at,
    pic: r.pic ?? "",
    latestStatus: r.latest_status ?? "",
    reason: r.reason ?? "",
  };
}

// Warranty Claims doesn't change from second to second — caching the read
// for a short window means clicking between tabs doesn't re-hit Supabase
// every single time, while every write below busts the cache immediately
// via updateTag so edits still show up right away.
const cachedWarrantyClaims = unstable_cache(
  async (branch: Branch): Promise<WarrantyClaim[]> => {
    const { data, error } = await supabaseAdmin
      .from("cc_warranty_claims")
      .select("*")
      .eq("branch", branch)
      .order("submitted_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Row[]).map(toClaim);
  },
  ["warranty-claims-by-branch"],
  { revalidate: 60, tags: ["warranty-claims"] }
);

export async function getWarrantyClaims(branch: Branch): Promise<WarrantyClaim[]> {
  await requireApproved();
  return cachedWarrantyClaims(branch);
}

// Claims across all 3 branches — for the "All Branches" view.
export async function getAllBranchesWarrantyClaims(): Promise<WarrantyClaim[]> {
  await requireApproved();
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getWarrantyClaims(value)));
  return perBranch.flat().sort((a, b) => b.submittedDate.localeCompare(a.submittedDate));
}

export async function getWarrantyClaimById(id: string): Promise<WarrantyClaim | null> {
  await requireApproved();
  const { data, error } = await supabaseAdmin.from("cc_warranty_claims").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toClaim(data as Row) : null;
}

export async function addWarrantyClaimAction(input: {
  branch: Branch;
  ticketId: string;
  customerName: string;
  plateNo: string;
  model: string;
  phone: string;
  description: string;
  stockStatus: StockStatus;
  bikeMake: BikeMake;
  submittedDate: string;
  pic?: string;
  latestStatus?: string;
  reason?: string;
}): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);

  if (!input.description.trim()) {
    return { error: "Please describe the issue before saving." };
  }
  if (!input.ticketId.trim() || !input.customerName.trim() || !input.plateNo.trim()) {
    return { error: "Ticket ID, customer name, and plate number are required." };
  }

  const { error } = await supabaseAdmin.from("cc_warranty_claims").insert({
    branch: input.branch,
    claim_no: input.ticketId.trim(),
    customer_name: input.customerName.trim(),
    plate_no: input.plateNo.trim(),
    model: input.model.trim(),
    phone: input.phone.trim(),
    description: input.description.trim(),
    stock_status: input.stockStatus,
    bike_make: input.bikeMake,
    submitted_date: input.submittedDate,
    status: "In Process",
    pic: input.pic?.trim() ?? "",
    latest_status: input.latestStatus?.trim() ?? "",
    reason: input.reason?.trim() ?? "",
  });
  if (error) return { error: error.message };
  await logActivity(user, "Added warranty claim", `${input.ticketId.trim()} — ${input.customerName.trim()} (${input.branch})`);
  revalidatePath("/warranty-claims");
  updateTag("warranty-claims");
  revalidatePath("/");
}

// The follow-up columns their sheet updates most often — edited inline
// from the claims table rather than through the full add form.
export async function updateClaimNotesAction(
  id: string,
  branch: Branch,
  input: { pic: string; latestStatus: string; reason: string }
): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin
    .from("cc_warranty_claims")
    .update({
      pic: input.pic.trim(),
      latest_status: input.latestStatus.trim(),
      reason: input.reason.trim(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Updated warranty claim notes", `claim ${id}`);
  revalidatePath("/warranty-claims");
  updateTag("warranty-claims");
}

export async function updateClaimStatusAction(
  id: string,
  branch: Branch,
  status: ClaimStatus
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_warranty_claims").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Set warranty claim status", `claim ${id} → ${status}`);
  revalidatePath("/warranty-claims");
  updateTag("warranty-claims");
  revalidatePath("/");
}

export async function updateClaimStockStatusAction(
  id: string,
  branch: Branch,
  stockStatus: StockStatus
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_warranty_claims").update({ stock_status: stockStatus }).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Set warranty claim stock status", `claim ${id} → ${stockStatus}`);
  revalidatePath("/warranty-claims");
  updateTag("warranty-claims");
}

export async function deleteClaimAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: claim } = await supabaseAdmin.from("cc_warranty_claims").select("claim_no, customer_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_warranty_claims").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Deleted warranty claim", `${claim?.claim_no ?? id} — ${claim?.customer_name ?? ""} (${branch})`);
  revalidatePath("/warranty-claims");
  updateTag("warranty-claims");
  revalidatePath("/");
}
