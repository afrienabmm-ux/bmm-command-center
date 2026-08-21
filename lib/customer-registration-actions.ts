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
  const tier = "Bronze";
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

export type MembershipLookup = {
  customerName: string;
  cardNumber: string;
  tier: string;
  issuedDate: string;
  expiryDate: string | null;
  totalSpend: number;
  visitCount: number;
};

// Public — a returning customer checks their own card by phone number. The
// spend/visit total is aggregated from Walk-in jobs by name the same way
// GenBlu points and the staff Memberships page already do; only the
// looked-up customer's own numbers ever come back.
export async function lookupMembershipAction(customerPhone: string): Promise<{ error: string } | MembershipLookup> {
  const phone = customerPhone.trim();
  if (!phone) return { error: "Enter the phone number you signed up with." };

  const { data: cards, error: cardError } = await supabaseAdmin
    .from("cc_customer_cards")
    .select("customer_name, card_number, tier, issued_date, expiry_date")
    .eq("customer_phone", phone)
    .limit(1);
  if (cardError) return { error: cardError.message };
  if (!cards || cards.length === 0) {
    return { error: "No membership card found for that phone number. Sign up above to get one." };
  }
  const card = cards[0];

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("customer_name, revenue_amount")
    .eq("job_type", "Walk-in");
  if (jobsError) return { error: jobsError.message };

  const normalized = card.customer_name.trim().toLowerCase();
  let totalSpend = 0;
  let visitCount = 0;
  for (const job of jobs ?? []) {
    if ((job.customer_name ?? "").trim().toLowerCase() === normalized) {
      totalSpend += Number(job.revenue_amount);
      visitCount += 1;
    }
  }

  return {
    customerName: card.customer_name,
    cardNumber: card.card_number,
    tier: card.tier,
    issuedDate: card.issued_date,
    expiryDate: card.expiry_date,
    totalSpend,
    visitCount,
  };
}
