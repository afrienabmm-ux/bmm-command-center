"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { DeliveryClaim, ClaimStatus, StockStatus } from "./types";
import { BRANCHES, type Branch } from "./branch";

type Row = {
  id: string;
  branch: Branch;
  ticket_id: string;
  pic: string;
  model: string;
  chassis_no: string;
  engine_no: string;
  problem: string;
  status: ClaimStatus;
  stock_status: StockStatus;
  plate_no: string;
  date_parts: string;
  delivery: string;
  reason: string;
  submitted_date: string;
  created_at: string;
};

function toClaim(r: Row): DeliveryClaim {
  return {
    id: r.id,
    branch: r.branch,
    ticketId: r.ticket_id,
    pic: r.pic ?? "",
    model: r.model,
    chassisNo: r.chassis_no,
    engineNo: r.engine_no,
    problem: r.problem,
    status: r.status,
    stockStatus: r.stock_status,
    plateNo: r.plate_no,
    dateParts: r.date_parts ?? "",
    delivery: r.delivery ?? "",
    reason: r.reason ?? "",
    submittedDate: r.submitted_date,
    createdAt: r.created_at,
  };
}

export async function getDeliveryClaims(branch: Branch): Promise<DeliveryClaim[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_delivery_claims")
    .select("*")
    .eq("branch", branch)
    .order("submitted_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toClaim);
}

// Claims across all 3 branches — for the "All Branches" view.
export async function getAllBranchesDeliveryClaims(): Promise<DeliveryClaim[]> {
  await requireApproved();
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getDeliveryClaims(value)));
  return perBranch.flat().sort((a, b) => b.submittedDate.localeCompare(a.submittedDate));
}

export async function addDeliveryClaimAction(input: {
  branch: Branch;
  ticketId: string;
  pic: string;
  model: string;
  chassisNo: string;
  engineNo: string;
  problem: string;
  stockStatus: StockStatus;
  plateNo: string;
  dateParts?: string;
  delivery?: string;
  reason?: string;
  submittedDate: string;
}): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);

  if (!input.problem.trim()) {
    return { error: "Please describe the problem before saving." };
  }
  if (!input.ticketId.trim() || !input.plateNo.trim()) {
    return { error: "Ticket ID and plate number are required." };
  }

  const { error } = await supabaseAdmin.from("cc_delivery_claims").insert({
    branch: input.branch,
    ticket_id: input.ticketId.trim(),
    pic: input.pic.trim(),
    model: input.model.trim(),
    chassis_no: input.chassisNo.trim(),
    engine_no: input.engineNo.trim(),
    problem: input.problem.trim(),
    status: "In Process",
    stock_status: input.stockStatus,
    plate_no: input.plateNo.trim(),
    date_parts: input.dateParts?.trim() ?? "",
    delivery: input.delivery?.trim() ?? "",
    reason: input.reason?.trim() ?? "",
    submitted_date: input.submittedDate,
  });
  if (error) return { error: error.message };
  revalidatePath("/warranty-claims");
  revalidatePath("/");
}

// The follow-up columns updated most often as parts come in — edited
// inline from the table rather than through the full add form.
export async function updateDeliveryClaimNotesAction(
  id: string,
  branch: Branch,
  input: { pic?: string; dateParts: string; delivery: string; reason: string }
): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const update: Record<string, string> = {
    date_parts: input.dateParts.trim(),
    delivery: input.delivery.trim(),
    reason: input.reason.trim(),
  };
  if (input.pic !== undefined) update.pic = input.pic.trim();
  const { error } = await supabaseAdmin.from("cc_delivery_claims").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/warranty-claims");
}

export async function updateDeliveryClaimStatusAction(
  id: string,
  branch: Branch,
  status: ClaimStatus
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_delivery_claims").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/warranty-claims");
  revalidatePath("/");
}

export async function updateDeliveryClaimStockStatusAction(
  id: string,
  branch: Branch,
  stockStatus: StockStatus
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_delivery_claims").update({ stock_status: stockStatus }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/warranty-claims");
}

export async function deleteDeliveryClaimAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_delivery_claims").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/warranty-claims");
  revalidatePath("/");
}
