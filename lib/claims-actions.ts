"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { WarrantyClaim, ClaimStatus } from "./types";
import type { Branch } from "./branch";

type Row = {
  id: string;
  branch: Branch;
  claim_no: string;
  customer_name: string;
  plate_no: string;
  description: string;
  status: ClaimStatus;
  submitted_date: string;
  created_at: string;
};

function toClaim(r: Row): WarrantyClaim {
  return {
    id: r.id,
    branch: r.branch,
    claimNo: r.claim_no,
    customerName: r.customer_name,
    plateNo: r.plate_no,
    description: r.description,
    status: r.status,
    submittedDate: r.submitted_date,
    createdAt: r.created_at,
  };
}

export async function getWarrantyClaims(branch: Branch): Promise<WarrantyClaim[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_warranty_claims")
    .select("*")
    .eq("branch", branch)
    .order("submitted_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toClaim);
}

export async function addWarrantyClaimAction(input: {
  branch: Branch;
  customerName: string;
  plateNo: string;
  description: string;
  submittedDate: string;
}): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const { count } = await supabaseAdmin
    .from("cc_warranty_claims")
    .select("*", { count: "exact", head: true })
    .eq("branch", input.branch);
  const claimNo = `WC-${input.branch.toUpperCase()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const { error } = await supabaseAdmin.from("cc_warranty_claims").insert({
    branch: input.branch,
    claim_no: claimNo,
    customer_name: input.customerName,
    plate_no: input.plateNo,
    description: input.description,
    submitted_date: input.submittedDate,
    status: "Submitted",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/warranty-claims");
}

export async function updateClaimStatusAction(id: string, branch: Branch, status: ClaimStatus): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_warranty_claims").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/warranty-claims");
}
