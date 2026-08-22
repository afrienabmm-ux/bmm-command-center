"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import type { Branch } from "./branch";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Visits (and therefore stamp progress) are counted from Walk-in job history matched
// by phone first, name second — same approach as the staff Memberships
// page. Phone survives name typos/spelling variants between visits.
async function countVisits(customerName: string, customerPhone?: string): Promise<number> {
  const normalizedName = customerName.trim().toLowerCase();
  const normalizedPhone = customerPhone ? normalizePhone(customerPhone) : "";
  if (!normalizedName && !normalizedPhone) return 0;
  const { data: jobs, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("customer_name, customer_phone")
    .eq("job_type", "Walk-in");
  if (error) throw new Error(error.message);
  return (jobs ?? []).filter((j) => {
    const jobPhone = normalizePhone(j.customer_phone ?? "");
    if (normalizedPhone && jobPhone && jobPhone === normalizedPhone) return true;
    return (j.customer_name ?? "").trim().toLowerCase() === normalizedName;
  }).length;
}

// Public — called from /join, which has no staff login. Every other
// customers-actions.ts function requires an approved staff session; this
// one deliberately doesn't, since it's the customer registering themselves.
const BRANCH_PREFIX: Record<Branch, string> = { kapar: "HQ", setia_alam: "ST", puncak_alam: "PA" };

function generateCardNumber(branch: Branch): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MC-${BRANCH_PREFIX[branch]}-${rand}`;
}

// Shared by registration — a phone already used on another card can't be
// reused for a new one.
async function findRegistrationDuplicate(phone: string): Promise<{ error: string } | null> {
  if (!phone) return null;
  const { data, error } = await supabaseAdmin.from("cc_customer_cards").select("id").eq("customer_phone", phone).limit(1);
  if (error) return { error: error.message };
  if (data && data.length > 0) {
    return { error: "This phone number is already registered. Use \"Check My Card\" above to view your services card instead." };
  }
  return null;
}

export async function registerCustomerCardAction(input: {
  branch: Branch;
  customerName: string;
  customerPhone: string;
  plateNo: string;
  model: string;
  boughtBikeHere: boolean;
}): Promise<{ error: string } | { cardNumber: string; visitCount: number; plateNo: string }> {
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  if (!customerName) return { error: "Please enter your name." };
  if (!customerPhone) return { error: "Please enter your phone number." };
  if (!input.plateNo.trim()) return { error: "Please enter your bike's plate number." };
  if (!input.boughtBikeHere) {
    return { error: "This services card is only for customers who bought their bike from us." };
  }

  const dupError = await findRegistrationDuplicate(customerPhone);
  if (dupError) return dupError;

  const cardNumber = generateCardNumber(input.branch);
  const visits = await countVisits(customerName, customerPhone);
  const plateNo = input.plateNo.trim();
  const { error } = await supabaseAdmin.from("cc_customer_cards").insert({
    branch: input.branch,
    customer_name: customerName,
    customer_phone: customerPhone,
    card_number: cardNumber,
    plate_no: plateNo,
    model: input.model.trim(),
    bought_bike_here: true,
    issued_date: new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { cardNumber, visitCount: visits, plateNo };
}

export type MembershipLookup = {
  customerName: string;
  cardNumber: string;
  plateNo: string;
  issuedDate: string;
  expiryDate: string | null;
  totalSpend: number;
  visitCount: number;
};

async function buildLookupResult(card: {
  customer_name: string;
  customer_phone: string;
  card_number: string;
  plate_no: string;
  issued_date: string;
  expiry_date: string | null;
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
  };
}

// Accepts either the phone number the customer signed up with, or their
// plate number — handy for a customer who doesn't remember which number
// they used but definitely knows their own plate.
async function findCardByPhoneOrPlate(query: string) {
  const cols = "customer_name, customer_phone, card_number, plate_no, issued_date, expiry_date";
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

// "Check my card" — no OTP, since this is just a stamp-reward card, not an
// account with anything sensitive on it. Looked up straight away by phone
// or, failing that, plate number.
export async function lookupCustomerCardAction(phoneOrPlate: string): Promise<{ error: string } | MembershipLookup> {
  const query = phoneOrPlate.trim();
  if (!query) return { error: "Enter the phone number you signed up with, or your plate number." };

  const card = await findCardByPhoneOrPlate(query);
  if (!card) return { error: "No services card found for that phone number or plate number. Sign up above to get one." };

  return buildLookupResult(card);
}
