"use server";

import { supabaseAdmin } from "./supabase-server";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export type MembershipLookup = {
  customerName: string;
  cardNumber: string;
  plateNo: string;
  issuedDate: string;
  expiryDate: string | null;
  totalSpend: number;
  visitCount: number;
  stamps: number[];
};

async function buildLookupResult(card: {
  customer_name: string;
  customer_phone: string;
  card_number: string;
  plate_no: string;
  issued_date: string;
  expiry_date: string | null;
  stamps: number[] | null;
}): Promise<MembershipLookup> {
  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("customer_name, customer_phone, revenue_amount")
    .eq("job_type", "Walk-in");
  if (jobsError) throw new Error(jobsError.message);

  const normalizedName = card.customer_name.trim().toLowerCase();
  const normalizedPhone = normalizePhone(card.customer_phone);
  let totalSpend = 0;
  let visitCount = 0;
  for (const job of jobs ?? []) {
    const jobPhone = normalizePhone(job.customer_phone ?? "");
    const matches =
      (normalizedPhone && jobPhone && jobPhone === normalizedPhone) ||
      (job.customer_name ?? "").trim().toLowerCase() === normalizedName;
    if (matches) {
      totalSpend += Number(job.revenue_amount);
      visitCount += 1;
    }
  }

  return {
    customerName: card.customer_name,
    cardNumber: card.card_number,
    plateNo: card.plate_no,
    issuedDate: card.issued_date,
    expiryDate: card.expiry_date,
    totalSpend,
    visitCount,
    stamps: card.stamps ?? [],
  };
}

// Accepts either the phone number the customer signed up with, or their
// plate number — handy for a customer who doesn't remember which number
// they used but definitely knows their own plate.
async function findCardByPhoneOrPlate(query: string) {
  const cols = "customer_name, customer_phone, card_number, plate_no, issued_date, expiry_date, stamps";
  const { data: byPhone, error: phoneError } = await supabaseAdmin
    .from("cc_customer_cards")
    .select(cols)
    .eq("customer_phone", query)
    .limit(1);
  if (phoneError) throw new Error(phoneError.message);
  if (byPhone && byPhone.length > 0) return byPhone[0];

  const { data: byPlate, error: plateError } = await supabaseAdmin.from("cc_customer_cards").select(cols).ilike("plate_no", query).limit(1);
  if (plateError) throw new Error(plateError.message);
  return byPlate && byPlate.length > 0 ? byPlate[0] : null;
}

// Public — called from /join, which has no staff login. Every card is now
// issued by staff from the Services Card page, so this is the only thing
// /join does: a no-OTP lookup by phone or plate, since it's just a
// stamp-reward card, not an account with anything sensitive on it.
export async function lookupCustomerCardAction(phoneOrPlate: string): Promise<{ error: string } | MembershipLookup> {
  const query = phoneOrPlate.trim();
  if (!query) return { error: "Enter your phone number or plate number." };

  const card = await findCardByPhoneOrPlate(query);
  if (!card) return { error: "No services card found for that phone number or plate number. Please check with staff." };

  return buildLookupResult(card);
}
