"use server";

import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "./supabase-server";
import type { Branch } from "./branch";
import { tierForVisits } from "./membership";

// Visits (and therefore tier) are counted from Walk-in job history matched
// by name, the same way the staff Memberships page and GenBlu points work.
async function countVisits(customerName: string): Promise<number> {
  const normalized = customerName.trim().toLowerCase();
  if (!normalized) return 0;
  const { data: jobs, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("customer_name")
    .eq("job_type", "Walk-in");
  if (error) throw new Error(error.message);
  return (jobs ?? []).filter((j) => (j.customer_name ?? "").trim().toLowerCase() === normalized).length;
}

// Public — called from /join, which has no staff login. Every other
// customers-actions.ts function requires an approved staff session; this
// one deliberately doesn't, since it's the customer registering themselves.
const BRANCH_PREFIX: Record<Branch, string> = { kapar: "HQ", setia_alam: "ST", puncak_alam: "PA" };

function generateCardNumber(branch: Branch): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MC-${BRANCH_PREFIX[branch]}-${rand}`;
}

const OTP_TTL_MINUTES = 10;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Sends through the business's Gmail account (SMTP + an app password) —
// free, and doesn't need a verified domain the way Resend's sandbox mode
// does. Reused by both registration and "check my card".
let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  cachedTransporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return cachedTransporter;
}

// Shared by both registration and the "check my card" lookup — sends a
// 6-digit code to the given email and stores it for verifyOtpCode to
// check. Free to run (unlike SMS OTP, which costs money per message) —
// that's why both flows verify email instead of phone.
async function sendOtpCode(email: string): Promise<{ error: string } | { sent: true }> {
  const transporter = getTransporter();
  if (!transporter) return { error: "Email verification isn't set up yet — please contact BMM staff." };

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("cc_email_otps").insert({
    email,
    code,
    expires_at: expiresAt,
  });
  if (error) return { error: error.message };

  try {
    await transporter.sendMail({
      from: `BMM Membership <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your BMM Membership verification code",
      html: `<p>Your verification code is <strong style="font-size:20px;letter-spacing:2px;">${code}</strong></p><p>It expires in ${OTP_TTL_MINUTES} minutes.</p>`,
    });
  } catch {
    return { error: "Couldn't send the verification email. Please check the address and try again." };
  }
  return { sent: true };
}

// Masks an email for display before it's verified — e.g. "jo***@gmail.com"
// — so the lookup screen can show which address the code went to without
// revealing the full address to whoever typed in the phone number.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
}

export async function sendRegistrationOtpAction(email: string): Promise<{ error: string } | { sent: true }> {
  const trimmed = normalizeEmail(email);
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email address." };
  return sendOtpCode(trimmed);
}

async function verifyOtpCode(email: string, code: string): Promise<{ error: string } | { verified: true }> {
  const enteredCode = code.trim();
  if (!enteredCode) return { error: "Enter the code from your email." };

  const { data, error } = await supabaseAdmin
    .from("cc_email_otps")
    .select("id, code, expires_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No code was sent to this email. Request a new one." };

  const row = data[0];
  if (new Date(row.expires_at) < new Date()) return { error: "This code has expired. Request a new one." };
  if (row.code !== enteredCode) return { error: "Incorrect code — please try again." };

  const { error: updateError } = await supabaseAdmin.from("cc_email_otps").update({ verified: true }).eq("id", row.id);
  if (updateError) return { error: updateError.message };
  return { verified: true };
}

export async function verifyRegistrationOtpAction(email: string, code: string): Promise<{ error: string } | { verified: true }> {
  return verifyOtpCode(normalizeEmail(email), code);
}

async function hasVerifiedOtp(email: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("cc_email_otps")
    .select("id")
    .eq("email", normalizeEmail(email))
    .eq("verified", true)
    .gte("expires_at", new Date().toISOString())
    .limit(1);
  return !!data && data.length > 0;
}

export async function registerCustomerCardAction(input: {
  branch: Branch;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}): Promise<{ error: string } | { cardNumber: string; tier: string }> {
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  const customerEmail = normalizeEmail(input.customerEmail);
  if (!customerName) return { error: "Please enter your name." };
  if (!customerPhone) return { error: "Please enter your phone number." };
  if (!customerEmail) return { error: "Please verify your email first." };

  const verified = await hasVerifiedOtp(customerEmail);
  if (!verified) return { error: "Please verify your email first." };

  // Signing up again with the same phone number hands back the existing
  // card instead of creating a duplicate.
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("cc_customer_cards")
    .select("card_number, customer_name")
    .eq("customer_phone", customerPhone)
    .limit(1);
  if (fetchError) return { error: fetchError.message };
  if (existing && existing.length > 0) {
    const visits = await countVisits(existing[0].customer_name);
    return { cardNumber: existing[0].card_number, tier: tierForVisits(visits) };
  }

  const cardNumber = generateCardNumber(input.branch);
  const visits = await countVisits(customerName);
  const tier = tierForVisits(visits);
  const { error } = await supabaseAdmin.from("cc_customer_cards").insert({
    branch: input.branch,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
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

async function buildLookupResult(card: {
  customer_name: string;
  card_number: string;
  issued_date: string;
  expiry_date: string | null;
}): Promise<MembershipLookup> {
  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("customer_name, revenue_amount")
    .eq("job_type", "Walk-in");
  if (jobsError) throw new Error(jobsError.message);

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
    tier: tierForVisits(visitCount),
    issuedDate: card.issued_date,
    expiryDate: card.expiry_date,
    totalSpend,
    visitCount,
  };
}

async function findCardByPhone(phone: string) {
  const { data, error } = await supabaseAdmin
    .from("cc_customer_cards")
    .select("customer_name, customer_email, card_number, issued_date, expiry_date")
    .eq("customer_phone", phone)
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : null;
}

// Step 1 of "check my card": find the card by phone and, if it has a
// verified email on file, send a code there instead of showing anything
// yet — so typing in someone else's phone number can't show their card.
// Cards with no email on file (added by staff, or from before this
// feature existed) fall back to showing the lookup straight away.
export async function requestLookupOtpAction(
  customerPhone: string
): Promise<{ error: string } | { needsOtp: true; emailHint: string } | { needsOtp: false; result: MembershipLookup }> {
  const phone = customerPhone.trim();
  if (!phone) return { error: "Enter the phone number you signed up with." };

  const card = await findCardByPhone(phone);
  if (!card) return { error: "No membership card found for that phone number. Sign up above to get one." };

  if (!card.customer_email) {
    const result = await buildLookupResult(card);
    return { needsOtp: false, result };
  }

  const sendResult = await sendOtpCode(card.customer_email);
  if ("error" in sendResult) return sendResult;
  return { needsOtp: true, emailHint: maskEmail(card.customer_email) };
}

// Step 2 — verifies the code against the card's own email, then returns
// the full lookup.
export async function verifyLookupOtpAction(customerPhone: string, code: string): Promise<{ error: string } | MembershipLookup> {
  const phone = customerPhone.trim();
  const card = await findCardByPhone(phone);
  if (!card) return { error: "No membership card found for that phone number." };
  if (!card.customer_email) return { error: "This card has no email on file to verify." };

  const verifyResult = await verifyOtpCode(card.customer_email, code);
  if ("error" in verifyResult) return verifyResult;

  return buildLookupResult(card);
}
