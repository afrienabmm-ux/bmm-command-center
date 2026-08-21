"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import type { Branch } from "./branch";

// Public — called from /join, which has no staff login. Every other
// customers-actions.ts function requires an approved staff session; this
// one deliberately doesn't, since it's the customer registering themselves.
const BRANCH_PREFIX: Record<Branch, string> = { kapar: "HQ", setia_alam: "ST", puncak_alam: "PA" };

function generateCardNumber(branch: Branch): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MC-${BRANCH_PREFIX[branch]}-${rand}`;
}

export async function registerCustomerCardAction(input: {
  branch: Branch;
  customerName: string;
  customerPhone: string;
}): Promise<{ error: string } | { cardNumber: string; tier: string }> {
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  if (!customerName) return { error: "Please enter your name." };
  if (!customerPhone) return { error: "Please enter your phone number." };

  // Signing up again with the same phone number hands back the existing
  // card instead of creating a duplicate.
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("cc_customer_cards")
    .select("card_number, tier")
    .eq("customer_phone", customerPhone)
    .limit(1);
  if (fetchError) return { error: fetchError.message };
  if (existing && existing.length > 0) return { cardNumber: existing[0].card_number, tier: existing[0].tier };

  const cardNumber = generateCardNumber(input.branch);
  const tier = "Member";
  const { error } = await supabaseAdmin.from("cc_customer_cards").insert({
    branch: input.branch,
    customer_name: customerName,
    customer_phone: customerPhone,
    card_number: cardNumber,
    tier,
    issued_date: new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { cardNumber, tier };
}
