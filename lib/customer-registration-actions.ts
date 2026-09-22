"use server";

import { supabaseAdmin } from "./supabase-server";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// The Sales Dashboard's QR link always sends a plate in capitals with no
// spaces ("VRJ9526"), which won't match a plate saved here with a space
// ("VRJ 9526") via a plain case-insensitive equality check — comparing
// with spaces and casing stripped from both sides is what actually makes
// the two agree.
function normalizePlate(plate: string): string {
  return plate.replace(/\s+/g, "").toUpperCase();
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

// Shown when a phone number matches more than one card — a repeat customer
// with a second (or third) bike, each with its own card. A plate number is
// always unique to one bike, so a plate search never needs this.
export type LookupChoice = { plateNo: string; model: string; cardNumber: string };

async function buildLookupResult(card: LookupCard): Promise<MembershipLookup> {
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

type LookupCard = {
  customer_name: string;
  customer_phone: string;
  card_number: string;
  plate_no: string;
  model: string;
  issued_date: string;
  expiry_date: string | null;
  stamps: number[] | null;
};

const LOOKUP_COLS = "customer_name, customer_phone, card_number, plate_no, model, issued_date, expiry_date, stamps";

// Accepts either the phone number the customer signed up with, or their
// plate number — handy for a customer who doesn't remember which number
// they used but definitely knows their own plate. A plate always names one
// bike, so it's checked first and, once matched, returned directly with no
// ambiguity. A phone number can now carry more than one card (a repeat
// customer's second bike has its own), so that search returns every match
// for the caller to disambiguate.
async function findCardsByPhoneOrPlate(query: string): Promise<LookupCard[]> {
  const { data: byPlate, error: plateError } = await supabaseAdmin.from("cc_customer_cards").select(LOOKUP_COLS).ilike("plate_no", query).limit(1);
  if (plateError) throw new Error(plateError.message);
  if (byPlate && byPlate.length > 0) return byPlate;

  const { data: byPhone, error: phoneError } = await supabaseAdmin.from("cc_customer_cards").select(LOOKUP_COLS).eq("customer_phone", query);
  if (phoneError) throw new Error(phoneError.message);
  if (byPhone && byPhone.length > 0) return byPhone;

  // Neither exact match hit — the query might just be formatted
  // differently than what's on file (a dash in a phone number, a missing
  // space in a plate). Compare every card's own value with that kind of
  // punctuation stripped instead; small table, so fetching every row once
  // here (only after both faster exact matches have already failed) is
  // cheap.
  const normalizedPhoneQuery = normalizePhone(query);
  const normalizedPlateQuery = normalizePlate(query);
  if (!normalizedPhoneQuery && !normalizedPlateQuery) return [];

  const { data: all, error: allError } = await supabaseAdmin.from("cc_customer_cards").select(LOOKUP_COLS);
  if (allError) throw new Error(allError.message);

  if (normalizedPlateQuery) {
    const plateMatch = (all ?? []).find((c) => normalizePlate(c.plate_no) === normalizedPlateQuery);
    if (plateMatch) return [plateMatch];
  }
  // Guarded to a plausible phone length so a short plate's own digits
  // (e.g. "6005" out of "SPA6005") can't coincidentally match part of an
  // unrelated customer's phone number.
  if (normalizedPhoneQuery.length >= 9) {
    const phoneMatches = (all ?? []).filter((c) => normalizePhone(c.customer_phone) === normalizedPhoneQuery);
    if (phoneMatches.length > 0) return phoneMatches;
  }
  return [];
}

// Public — called from /join, which has no staff login. Every card is now
// issued by staff from the Services Card page, so this is the only thing
// /join does: a no-OTP lookup by phone or plate, since it's just a
// stamp-reward card, not an account with anything sensitive on it.
export async function lookupCustomerCardAction(
  phoneOrPlate: string
): Promise<{ error: string } | { choices: LookupChoice[] } | MembershipLookup> {
  const query = phoneOrPlate.trim();
  if (!query) return { error: "Enter your phone number or plate number." };

  const cards = await findCardsByPhoneOrPlate(query);
  if (cards.length === 0) return { error: "No services card found for that phone number or plate number. Please check with staff." };
  if (cards.length > 1) {
    return { choices: cards.map((c) => ({ plateNo: c.plate_no, model: c.model, cardNumber: c.card_number })) };
  }
  return buildLookupResult(cards[0]);
}
