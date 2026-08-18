"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { GenbluRegistration } from "./types";
import { BRANCHES, type Branch } from "./branch";
import { extractTextFromImage } from "./vision";

const BUCKET = "genblu-screenshots";

type Row = {
  id: string;
  branch: Branch;
  salesperson_name: string;
  salesperson_code: string;
  customer_name: string;
  customer_plate_no: string;
  screenshot_path: string | null;
  created_at: string;
};

function toReg(r: Row): GenbluRegistration {
  return {
    id: r.id,
    branch: r.branch,
    salespersonName: r.salesperson_name,
    salespersonCode: r.salesperson_code,
    customerName: r.customer_name,
    customerPlateNo: r.customer_plate_no,
    screenshotPath: r.screenshot_path,
    createdAt: r.created_at,
  };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// Auto-registrations should credit whoever is actually logged in and doing
// the job (their initials, e.g. "Nurul Izzah" -> "NI"), not the mechanic
// assigned to the job — a PIC can register a customer for GenBlu on a job
// that isn't theirs to work on.
function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Strips everything but letters/digits so OCR line breaks or stray
// punctuation between name parts don't break the comparison.
function condensedName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// The GenBlu app screenshot should show the same customer's name — read it
// with the same OCR used for jobsheet scans and check it appears somewhere
// on the screenshot before accepting the upload.
async function screenshotMatchesName(screenshot: File, customerName: string): Promise<boolean> {
  const condensed = condensedName(customerName);
  if (!condensed) return true;
  const buffer = Buffer.from(await screenshot.arrayBuffer());
  const base64 = buffer.toString("base64");
  const text = await extractTextFromImage(base64);
  return condensedName(text).includes(condensed);
}

export async function getGenbluRegistrations(branch: Branch): Promise<GenbluRegistration[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .select("*")
    .eq("branch", branch)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toReg);
}

// Same as getGenbluRegistrations, but merged across all 3 branches for the
// "All Branches" combined view.
export async function getAllBranchesGenbluRegistrations(): Promise<GenbluRegistration[]> {
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getGenbluRegistrations(value)));
  return perBranch.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getScreenshotUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

// GenBlu points: 1 point per RM1 spent. Points aren't stored — they're
// computed on the fly by matching a registration's customer name (case/
// whitespace-insensitive) against completed Walk-in job spending, so a
// customer's total always reflects every job they've ever had, past or
// future, without a separate ledger to keep in sync.
export async function getGenbluPointsByName(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("customer_name, revenue_amount")
    .eq("job_type", "Walk-in");
  if (error) throw new Error(error.message);

  const points: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = normalizeName(row.customer_name ?? "");
    if (!key) continue;
    points[key] = (points[key] ?? 0) + Number(row.revenue_amount);
  }
  return points;
}

export async function addGenbluRegistrationAction(formData: FormData): Promise<{ error: string } | void> {
  const user = await requireApproved();
  const branch = String(formData.get("branch") || "") as Branch;
  assertCanEditBranch(user, branch);

  const salespersonName = String(formData.get("salesperson_name") || "").trim();
  const salespersonCode = String(formData.get("salesperson_code") || "").trim();
  const customerName = String(formData.get("customer_name") || "").trim();
  const customerPlateNo = String(formData.get("customer_plate_no") || "").trim();
  const screenshot = formData.get("screenshot") as File | null;

  if (!salespersonName || !customerPlateNo) {
    return { error: "Fill in the salesperson name and plate number." };
  }

  let screenshotPath: string | null = null;
  if (screenshot && screenshot.size > 0) {
    const ext = screenshot.name.split(".").pop() || "jpg";
    const path = `${branch}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, screenshot, {
      contentType: screenshot.type || "image/jpeg",
    });
    if (uploadError) return { error: `Couldn't upload the screenshot: ${uploadError.message}` };
    screenshotPath = path;
  }

  const { error } = await supabaseAdmin.from("cc_genblu_registrations").insert({
    branch,
    salesperson_name: salespersonName,
    salesperson_code: salespersonCode.toUpperCase(),
    customer_name: customerName,
    customer_plate_no: customerPlateNo,
    screenshot_path: screenshotPath,
  });
  if (error) return { error: error.message };
  revalidatePath("/genblu");
}

export async function updateGenbluRegistrationAction(
  id: string,
  branch: Branch,
  input: { salespersonName: string; salespersonCode: string; customerName: string; customerPlateNo: string }
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  const salespersonName = input.salespersonName.trim();
  const customerPlateNo = input.customerPlateNo.trim();
  if (!salespersonName || !customerPlateNo) {
    return { error: "Fill in the salesperson name and plate number." };
  }

  const { error } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .update({
      salesperson_name: salespersonName,
      salesperson_code: input.salespersonCode.trim().toUpperCase(),
      customer_name: input.customerName.trim(),
      customer_plate_no: customerPlateNo,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/genblu");
}

export async function deleteGenbluRegistrationAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_genblu_registrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/genblu");
}

// Checked from the Walk-in job form as soon as the PIC says the customer
// has GenBlu, so the form knows whether to ask for a screenshot (new
// customer) or skip it (already registered, screenshot already on file).
export async function checkGenbluRegisteredAction(branch: Branch, customerName: string): Promise<boolean> {
  await requireApproved();
  const name = normalizeName(customerName);
  if (!name) return false;

  const { data, error } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .select("customer_name")
    .eq("branch", branch);
  if (error) return false;

  return (data ?? []).some((r) => normalizeName(r.customer_name) === name);
}

// Called from the Walk-in job form when the PIC confirms the customer has
// GenBlu installed. Finds an existing registration for this customer (by
// name, case/whitespace-insensitive, within the branch) and leaves it
// alone, or creates one (with the screenshot the PIC just uploaded) so
// they start showing up in the tracker — points are computed separately
// from their job spending, not stored here.
export async function ensureGenbluRegistrationAction(input: {
  branch: Branch;
  customerName: string;
  customerPlateNo: string;
  screenshot?: File | null;
}): Promise<{ error: string } | { created: boolean }> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);

  const customerName = input.customerName.trim();
  if (!customerName) return { error: "Customer name is required to register GenBlu." };

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .select("id, customer_name")
    .eq("branch", input.branch);
  if (fetchError) return { error: fetchError.message };

  const match = (existing ?? []).find((r) => normalizeName(r.customer_name) === normalizeName(customerName));
  if (match) return { created: false };

  let screenshotPath: string | null = null;
  const screenshot = input.screenshot;
  if (screenshot && screenshot.size > 0) {
    let nameMatches = true;
    try {
      nameMatches = await screenshotMatchesName(screenshot, customerName);
    } catch {
      // If the OCR check itself fails (e.g. Vision hiccup), don't block
      // the registration over it — just skip the verification.
      nameMatches = true;
    }
    if (!nameMatches) {
      return {
        error: `The name on the GenBlu screenshot doesn't match "${customerName}" — please check the screenshot is for the right customer and try again.`,
      };
    }

    const ext = screenshot.name.split(".").pop() || "jpg";
    const path = `${input.branch}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, screenshot, {
      contentType: screenshot.type || "image/jpeg",
    });
    if (uploadError) return { error: `Couldn't upload the GenBlu screenshot: ${uploadError.message}` };
    screenshotPath = path;
  }

  const { error } = await supabaseAdmin.from("cc_genblu_registrations").insert({
    branch: input.branch,
    salesperson_name: user.name,
    salesperson_code: initialsFromName(user.name),
    customer_name: customerName,
    customer_plate_no: input.customerPlateNo.trim(),
    screenshot_path: screenshotPath,
  });
  if (error) return { error: error.message };
  revalidatePath("/genblu");
  return { created: true };
}
