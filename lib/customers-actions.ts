"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import { BRANCHES, type Branch } from "./branch";
import type { CustomerCard } from "./types";
import { logActivity } from "./activity-log";
import { generateUniqueCardNumber } from "./card-number";

type CardRow = {
  id: string;
  branch: Branch;
  customer_name: string;
  customer_phone: string;
  card_number: string;
  plate_no: string;
  model: string;
  bought_bike_here: boolean;
  under_250cc: boolean;
  issued_date: string;
  expiry_date: string | null;
  notes: string;
  created_at: string;
  stamps: number[] | null;
};

function toCard(r: CardRow): CustomerCard {
  return {
    id: r.id,
    branch: r.branch,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    cardNumber: r.card_number,
    plateNo: r.plate_no,
    model: r.model,
    boughtBikeHere: r.bought_bike_here,
    under250cc: r.under_250cc,
    issuedDate: r.issued_date,
    expiryDate: r.expiry_date,
    notes: r.notes,
    createdAt: r.created_at,
    stamps: r.stamps ?? [],
  };
}

// Services Cards are a plain manual database now — added and ticked by
// admin only, never aggregated from jobsheet or Services Combo history.
export async function getCustomers(branch: Branch): Promise<CustomerCard[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_customer_cards")
    .select("*")
    .eq("branch", branch)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CardRow[]).map(toCard);
}

// Same as getCustomers, but merged across all 3 branches for the "All
// Branches" combined view.
export async function getAllBranchesCustomers(): Promise<CustomerCard[]> {
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getCustomers(value)));
  return perBranch.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addCustomerCardAction(input: {
  branch: Branch;
  customerName: string;
  customerPhone: string;
  plateNo: string;
  model: string;
  boughtBikeHere: boolean;
  under250cc: boolean;
  issuedDate: string;
  expiryDate: string | null;
  notes: string;
}): Promise<{ error: string } | { cardNumber: string }> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const customerName = input.customerName.trim();
  if (!customerName) return { error: "Customer name is required." };
  // The stamp-reward card is only for customers who bought their bike from
  // us — no card at all for anyone else, rather than a card that just sits
  // there unable to earn rewards.
  if (!input.boughtBikeHere) {
    return { error: "Only customers who bought their bike from us are eligible for a services card." };
  }
  if (!input.under250cc) {
    return { error: "Bikes over 250cc aren't eligible for a services card." };
  }
  const customerPhone = input.customerPhone.trim();

  // These two checks don't depend on each other, so run them together
  // instead of one after another — halves the DB round-trips before the
  // actual insert.
  const [dupError, cardNumber] = await Promise.all([
    checkCustomerCardDuplicate(customerPhone),
    generateUniqueCardNumber(input.branch),
  ]);
  if (dupError) return dupError;

  const { error } = await supabaseAdmin.from("cc_customer_cards").insert({
    branch: input.branch,
    customer_name: customerName,
    customer_phone: customerPhone,
    card_number: cardNumber,
    plate_no: input.plateNo.trim(),
    model: input.model.trim(),
    bought_bike_here: input.boughtBikeHere,
    under_250cc: input.under250cc,
    issued_date: input.issuedDate,
    expiry_date: input.expiryDate || null,
    notes: input.notes.trim(),
  });
  if (error) return { error: error.message };
  await logActivity(user, "Added services card", `${customerName} — ${cardNumber} (${input.branch})`);
  revalidatePath("/customers");
  return { cardNumber };
}

// Same phone uniqueness check the public /join sign-up enforces — staff
// adding or editing a card here shouldn't be able to create a duplicate
// either. excludeId leaves the card being edited out of its own duplicate
// check.
async function checkCustomerCardDuplicate(phone: string, excludeId?: string): Promise<{ error: string } | null> {
  if (!phone) return null;
  let query = supabaseAdmin.from("cc_customer_cards").select("id").eq("customer_phone", phone).limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) return { error: error.message };
  if (data && data.length > 0) return { error: "This phone number is already registered to another services card." };
  return null;
}

export async function updateCustomerCardAction(
  id: string,
  branch: Branch,
  input: {
    customerName: string;
    customerPhone: string;
    cardNumber: string;
    plateNo: string;
    model: string;
    boughtBikeHere: boolean;
    under250cc: boolean;
    issuedDate: string;
    expiryDate: string | null;
    notes: string;
  }
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const customerName = input.customerName.trim();
  if (!customerName) return { error: "Customer name is required." };
  if (!input.boughtBikeHere) {
    return {
      error:
        "Only customers who bought their bike from us are eligible for a services card — delete the card instead of unchecking this.",
    };
  }
  if (!input.under250cc) {
    return {
      error: "Bikes over 250cc aren't eligible for a services card — delete the card instead of unchecking this.",
    };
  }
  const customerPhone = input.customerPhone.trim();

  const dupError = await checkCustomerCardDuplicate(customerPhone, id);
  if (dupError) return dupError;

  const { error } = await supabaseAdmin
    .from("cc_customer_cards")
    .update({
      customer_name: customerName,
      customer_phone: customerPhone,
      card_number: input.cardNumber.trim(),
      plate_no: input.plateNo.trim(),
      model: input.model.trim(),
      bought_bike_here: input.boughtBikeHere,
      under_250cc: input.under250cc,
      issued_date: input.issuedDate,
      expiry_date: input.expiryDate || null,
      notes: input.notes.trim(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Updated services card", `${customerName} (${branch})`);
  revalidatePath("/customers");
}

export async function deleteCustomerCardAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: card } = await supabaseAdmin.from("cc_customer_cards").select("customer_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_customer_cards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Deleted services card", `${card?.customer_name ?? id} (${branch})`);
  revalidatePath("/customers");
}

// Admin ticks/unticks stamps by hand — never derived from jobsheet visits.
export async function setCardStampsAction(id: string, branch: Branch, stamps: number[]): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const clean = Array.from(new Set(stamps.filter((n) => Number.isInteger(n) && n >= 1 && n <= 10))).sort((a, b) => a - b);
  const { error } = await supabaseAdmin.from("cc_customer_cards").update({ stamps: clean }).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Set services card stamps", `card ${id} → ${clean.length}/10`);
  revalidatePath("/customers");
}
