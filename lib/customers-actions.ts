"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, requireManagement, assertCanEditBranch } from "./current-user";
import { BRANCHES, type Branch, type BranchSelection } from "./branch";
import type { CustomerCard, CustomerSummary } from "./types";
import { getPackageSales, type PackageSaleWithNames } from "./packages-actions";
import { sendEmail } from "./email";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

type CardRow = {
  id: string;
  branch: Branch;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  card_number: string;
  bought_bike_here: boolean;
  issued_date: string;
  expiry_date: string | null;
  notes: string;
  created_at: string;
};

function toCard(r: CardRow): CustomerCard {
  return {
    id: r.id,
    branch: r.branch,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    cardNumber: r.card_number,
    boughtBikeHere: r.bought_bike_here,
    issuedDate: r.issued_date,
    expiryDate: r.expiry_date,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

async function getCustomerCards(branch: Branch): Promise<CustomerCard[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_customer_cards")
    .select("*")
    .eq("branch", branch)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CardRow[]).map(toCard);
}

type JobRow = {
  customer_name: string;
  customer_phone: string;
  plate_no: string;
  revenue_amount: number;
  completed_date: string | null;
  started_date: string | null;
  created_at: string;
};

// Customers aren't stored — they're aggregated from Walk-in job spending
// and Services Combo purchases, matched to a loyalty card (if one exists)
// by phone first and name second, since names can be spelled differently
// visit to visit but phone numbers don't change.
function buildSummaries(
  branch: Branch,
  jobs: JobRow[],
  sales: PackageSaleWithNames[],
  cards: CustomerCard[]
): CustomerSummary[] {
  const byKey = new Map<
    string,
    {
      name: string;
      totalSpend: number;
      jobCount: number;
      plates: Set<string>;
      lastVisit: string;
      packagesBought: Map<string, number>;
    }
  >();

  const cardByPhone = new Map(cards.filter((c) => c.customerPhone).map((c) => [normalizePhone(c.customerPhone), c]));
  const cardByName = new Map(cards.map((c) => [normalizeName(c.customerName), c]));

  function resolveCard(rawName: string, rawPhone?: string): CustomerCard | null {
    const phone = rawPhone ? normalizePhone(rawPhone) : "";
    if (phone && cardByPhone.has(phone)) return cardByPhone.get(phone)!;
    const name = normalizeName(rawName);
    return name ? cardByName.get(name) ?? null : null;
  }

  function entryFor(rawName: string, rawPhone?: string) {
    const card = resolveCard(rawName, rawPhone);
    const key = card ? `card:${card.id}` : `name:${normalizeName(rawName)}`;
    if (key === "name:") return null;
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        name: card ? card.customerName : rawName.trim(),
        totalSpend: 0,
        jobCount: 0,
        plates: new Set(),
        lastVisit: "",
        packagesBought: new Map(),
      };
      byKey.set(key, entry);
    }
    return entry;
  }

  for (const job of jobs) {
    const entry = entryFor(job.customer_name ?? "", job.customer_phone);
    if (!entry) continue;
    entry.totalSpend += Number(job.revenue_amount);
    entry.jobCount += 1;
    if (job.plate_no) entry.plates.add(job.plate_no);
    const visitDate = job.completed_date || job.started_date || job.created_at;
    if (visitDate && visitDate > entry.lastVisit) entry.lastVisit = visitDate;
  }

  for (const sale of sales) {
    const entry = entryFor(sale.customerName ?? "");
    if (!entry) continue;
    entry.packagesBought.set(sale.packageName, (entry.packagesBought.get(sale.packageName) ?? 0) + 1);
    if (sale.customerPlateNo) entry.plates.add(sale.customerPlateNo);
    if (sale.saleDate > entry.lastVisit) entry.lastVisit = sale.saleDate;
  }

  // Make sure a customer who only has a loyalty card so far (no spend on
  // file yet) still shows up in the list.
  for (const card of cards) {
    entryFor(card.customerName, card.customerPhone);
  }

  const cardById = new Map(cards.map((c) => [c.id, c]));

  return Array.from(byKey.entries())
    .map(([key, entry]) => {
      const card = key.startsWith("card:") ? cardById.get(key.slice(5)) ?? null : null;
      return {
        name: entry.name,
        branch,
        totalSpend: entry.totalSpend,
        jobCount: entry.jobCount,
        plates: Array.from(entry.plates),
        lastVisit: entry.lastVisit,
        packagesBought: Array.from(entry.packagesBought.entries()).map(([name, count]) => ({ name, count })),
        card,
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

export async function getCustomers(branch: Branch): Promise<CustomerSummary[]> {
  await requireApproved();
  const [{ data: jobs, error: jobsError }, sales, cards] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("customer_name, customer_phone, plate_no, revenue_amount, completed_date, started_date, created_at")
      .eq("branch", branch)
      .eq("job_type", "Walk-in"),
    getPackageSales(branch),
    getCustomerCards(branch),
  ]);
  if (jobsError) throw new Error(jobsError.message);
  return buildSummaries(branch, (jobs as JobRow[]) ?? [], sales, cards);
}

// Same as getCustomers, but merged across all 3 branches for the "All
// Branches" combined view.
export async function getAllBranchesCustomers(): Promise<CustomerSummary[]> {
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getCustomers(value)));
  return perBranch.flat().sort((a, b) => b.totalSpend - a.totalSpend);
}

export async function addCustomerCardAction(input: {
  branch: Branch;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  cardNumber: string;
  boughtBikeHere: boolean;
  issuedDate: string;
  expiryDate: string | null;
  notes: string;
}): Promise<{ error: string } | void> {
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
  const customerPhone = input.customerPhone.trim();
  const customerEmail = input.customerEmail.trim().toLowerCase();

  const dupError = await checkCustomerCardDuplicate(customerPhone, customerEmail);
  if (dupError) return dupError;

  const { error } = await supabaseAdmin.from("cc_customer_cards").insert({
    branch: input.branch,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    card_number: input.cardNumber.trim(),
    bought_bike_here: input.boughtBikeHere,
    issued_date: input.issuedDate,
    expiry_date: input.expiryDate || null,
    notes: input.notes.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/customers");
}

// Same phone/email uniqueness check the public /join sign-up enforces —
// staff adding or editing a card here shouldn't be able to create a
// duplicate either. excludeId leaves the card being edited out of its own
// duplicate check.
async function checkCustomerCardDuplicate(
  phone: string,
  email: string,
  excludeId?: string
): Promise<{ error: string } | null> {
  if (phone) {
    let query = supabaseAdmin.from("cc_customer_cards").select("id").eq("customer_phone", phone).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query;
    if (error) return { error: error.message };
    if (data && data.length > 0) return { error: "This phone number is already registered to another services card." };
  }
  if (email) {
    let query = supabaseAdmin.from("cc_customer_cards").select("id").eq("customer_email", email).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query;
    if (error) return { error: error.message };
    if (data && data.length > 0) return { error: "This email is already registered to another services card." };
  }
  return null;
}

export async function updateCustomerCardAction(
  id: string,
  branch: Branch,
  input: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    cardNumber: string;
    boughtBikeHere: boolean;
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
  const customerPhone = input.customerPhone.trim();
  const customerEmail = input.customerEmail.trim().toLowerCase();

  const dupError = await checkCustomerCardDuplicate(customerPhone, customerEmail, id);
  if (dupError) return dupError;

  const { error } = await supabaseAdmin
    .from("cc_customer_cards")
    .update({
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      card_number: input.cardNumber.trim(),
      bought_bike_here: input.boughtBikeHere,
      issued_date: input.issuedDate,
      expiry_date: input.expiryDate || null,
      notes: input.notes.trim(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/customers");
}

export async function deleteCustomerCardAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_customer_cards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}

// Management-only — emails every member in view (deduped by address) with
// the given subject/message and, optionally, a poster image. Only members
// who registered through /join (and so have a verified email on file) can
// be reached this way; free to run since it goes through the same Gmail
// account as OTP codes.
export async function sendPromotionAction(
  formData: FormData
): Promise<{ error: string } | { sentCount: number; failedCount: number }> {
  await requireManagement();

  const branchSelection = String(formData.get("branchSelection") || "all") as BranchSelection;
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  if (!subject) return { error: "Enter a subject." };
  if (!message) return { error: "Enter a message." };

  const customers =
    branchSelection === "all" ? await getAllBranchesCustomers() : await getCustomers(branchSelection);

  const emails = Array.from(
    new Set(
      customers
        .map((c) => c.card?.customerEmail?.trim().toLowerCase())
        .filter((e): e is string => !!e)
    )
  );
  if (emails.length === 0) return { error: "No members with an email on file in this view." };

  const poster = formData.get("poster");
  let attachments: { filename: string; content: Buffer; cid: string }[] | undefined;
  let posterHtml = "";
  if (poster instanceof File && poster.size > 0) {
    const buffer = Buffer.from(await poster.arrayBuffer());
    attachments = [{ filename: poster.name || "poster.jpg", content: buffer, cid: "promo-poster" }];
    posterHtml = `<p><img src="cid:promo-poster" alt="Promotion poster" style="max-width:100%;border-radius:8px;" /></p>`;
  }

  const html =
    message
      .split("\n")
      .map((line) => `<p>${line}</p>`)
      .join("") + posterHtml;

  let sentCount = 0;
  let failedCount = 0;
  for (const email of emails) {
    const result = await sendEmail({ to: email, subject, html, attachments });
    if ("error" in result) failedCount += 1;
    else sentCount += 1;
  }

  return { sentCount, failedCount };
}
