"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, requireManagement, assertCanEditBranch } from "./current-user";
import { BRANCHES, type Branch, type BranchSelection } from "./branch";
import type { CustomerCard, CustomerSummary } from "./types";
import { getPackageSales, type PackageSaleWithNames } from "./packages-actions";
import { tierForVisits } from "./membership";
import { sendEmail } from "./email";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

type CardRow = {
  id: string;
  branch: Branch;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  card_number: string;
  tier: string;
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
    tier: r.tier,
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
  plate_no: string;
  revenue_amount: number;
  completed_date: string | null;
  started_date: string | null;
  created_at: string;
};

// Customers aren't stored — they're aggregated from Walk-in job spending
// and Services Combo purchases by normalized name, the same way GenBlu
// points already work, then merged with a loyalty card if one exists.
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

  function entryFor(rawName: string) {
    const key = normalizeName(rawName);
    if (!key) return null;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { name: rawName.trim(), totalSpend: 0, jobCount: 0, plates: new Set(), lastVisit: "", packagesBought: new Map() };
      byKey.set(key, entry);
    }
    return entry;
  }

  for (const job of jobs) {
    const entry = entryFor(job.customer_name ?? "");
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
    entryFor(card.customerName);
  }

  const cardByKey = new Map(cards.map((c) => [normalizeName(c.customerName), c]));

  return Array.from(byKey.entries())
    .map(([key, entry]) => {
      const card = cardByKey.get(key) ?? null;
      return {
        name: entry.name,
        branch,
        totalSpend: entry.totalSpend,
        jobCount: entry.jobCount,
        plates: Array.from(entry.plates),
        lastVisit: entry.lastVisit,
        packagesBought: Array.from(entry.packagesBought.entries()).map(([name, count]) => ({ name, count })),
        // Tier is automatic (based on visit count), not whatever was last
        // stored — so it always reflects the customer's current standing.
        card: card ? { ...card, tier: tierForVisits(entry.jobCount) } : null,
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

export async function getCustomers(branch: Branch): Promise<CustomerSummary[]> {
  await requireApproved();
  const [{ data: jobs, error: jobsError }, sales, cards] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("customer_name, plate_no, revenue_amount, completed_date, started_date, created_at")
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
  cardNumber: string;
  tier: string;
  issuedDate: string;
  expiryDate: string | null;
  notes: string;
}): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const customerName = input.customerName.trim();
  if (!customerName) return { error: "Customer name is required." };
  const { error } = await supabaseAdmin.from("cc_customer_cards").insert({
    branch: input.branch,
    customer_name: customerName,
    customer_phone: input.customerPhone.trim(),
    card_number: input.cardNumber.trim(),
    tier: input.tier.trim(),
    issued_date: input.issuedDate,
    expiry_date: input.expiryDate || null,
    notes: input.notes.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/customers");
}

export async function updateCustomerCardAction(
  id: string,
  branch: Branch,
  input: {
    customerName: string;
    customerPhone: string;
    cardNumber: string;
    tier: string;
    issuedDate: string;
    expiryDate: string | null;
    notes: string;
  }
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const customerName = input.customerName.trim();
  if (!customerName) return { error: "Customer name is required." };
  const { error } = await supabaseAdmin
    .from("cc_customer_cards")
    .update({
      customer_name: customerName,
      customer_phone: input.customerPhone.trim(),
      card_number: input.cardNumber.trim(),
      tier: input.tier.trim(),
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
    posterHtml +
    message
      .split("\n")
      .map((line) => `<p>${line}</p>`)
      .join("");

  let sentCount = 0;
  let failedCount = 0;
  for (const email of emails) {
    const result = await sendEmail({ to: email, subject, html, attachments });
    if ("error" in result) failedCount += 1;
    else sentCount += 1;
  }

  return { sentCount, failedCount };
}
