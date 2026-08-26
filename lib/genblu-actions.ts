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
  points_accrued: number | null;
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
    pointsAccrued: r.points_accrued,
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

// Pulls the number after "Points Accrued" out of the screenshot's OCR text
// — that's the real, current balance from the GenBlu app itself, as opposed
// to the points estimate this dashboard computes from job spending. Only
// the label "points" is required (not the full word "accrued") since OCR
// misreads it inconsistently.
function extractPointsAccrued(text: string): number | null {
  const match = text.match(/points[^\d]{0,20}(\d[\d,]{0,6})/i);
  if (!match) return null;
  const num = Number(match[1].replace(/,/g, ""));
  return Number.isNaN(num) ? null : num;
}

// The GenBlu app screenshot should show the same customer's name — read it
// with the same OCR used for jobsheet scans, check it appears somewhere on
// the screenshot, and pull out the real points balance while we're at it
// (one OCR pass covers both checks).
async function analyzeGenbluScreenshot(
  screenshot: File,
  customerName: string
): Promise<{ nameMatches: boolean; pointsAccrued: number | null }> {
  const buffer = Buffer.from(await screenshot.arrayBuffer());
  const base64 = buffer.toString("base64");
  const text = await extractTextFromImage(base64);
  const condensed = condensedName(customerName);
  const nameMatches = !condensed || condensedName(text).includes(condensed);
  return { nameMatches, pointsAccrued: extractPointsAccrued(text) };
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
  let pointsAccrued: number | null = null;
  if (screenshot && screenshot.size > 0) {
    try {
      pointsAccrued = (await analyzeGenbluScreenshot(screenshot, customerName)).pointsAccrued;
    } catch {
      // Points extraction is a bonus, not a requirement — don't block the
      // registration if OCR hiccups.
    }
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
    points_accrued: pointsAccrued,
  });
  if (error) return { error: error.message };
  revalidatePath("/genblu");
}

export async function updateGenbluRegistrationAction(
  id: string,
  branch: Branch,
  input: {
    salespersonName: string;
    salespersonCode: string;
    customerName: string;
    customerPlateNo: string;
    // Only present when the PIC picked a new file — the existing
    // screenshot (and its path) is left untouched otherwise, since most
    // edits are just fixing a typo'd name and shouldn't wipe the photo.
    screenshot?: File | null;
  }
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  const salespersonName = input.salespersonName.trim();
  const customerPlateNo = input.customerPlateNo.trim();
  if (!salespersonName || !customerPlateNo) {
    return { error: "Fill in the salesperson name and plate number." };
  }

  const update: Record<string, string | number | null> = {
    salesperson_name: salespersonName,
    salesperson_code: input.salespersonCode.trim().toUpperCase(),
    customer_name: input.customerName.trim(),
    customer_plate_no: customerPlateNo,
  };

  if (input.screenshot && input.screenshot.size > 0) {
    try {
      update.points_accrued = (await analyzeGenbluScreenshot(input.screenshot, input.customerName)).pointsAccrued;
    } catch {
      // Points extraction is a bonus, not a requirement — don't block the save.
    }
    const ext = input.screenshot.name.split(".").pop() || "jpg";
    const path = `${branch}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, input.screenshot, {
      contentType: input.screenshot.type || "image/jpeg",
    });
    if (uploadError) return { error: `Couldn't upload the screenshot: ${uploadError.message}` };
    update.screenshot_path = path;
  }

  const { error } = await supabaseAdmin.from("cc_genblu_registrations").update(update).eq("id", id);
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
  let pointsAccrued: number | null = null;
  const screenshot = input.screenshot;
  if (screenshot && screenshot.size > 0) {
    let nameMatches = true;
    try {
      const analysis = await analyzeGenbluScreenshot(screenshot, customerName);
      nameMatches = analysis.nameMatches;
      pointsAccrued = analysis.pointsAccrued;
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
    points_accrued: pointsAccrued,
  });
  if (error) return { error: error.message };
  revalidatePath("/genblu");
  return { created: true };
}

// Used by the standalone phone Upload page, where uploading the photo IS
// the action — unlike ensureGenbluRegistrationAction (which skips the
// upload once a customer is already registered, since the jobsheet form
// that calls it only needs the screenshot once), this always attaches the
// screenshot: onto the existing registration if the customer already has
// one (adding this screenshot's points to their running total — see the
// comment below), or a newly created one otherwise.
export async function attachGenbluScreenshotAction(input: {
  branch: Branch;
  customerName: string;
  customerPlateNo: string;
  screenshot: File;
}): Promise<{ error: string } | { updated: boolean }> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);

  const customerName = input.customerName.trim();
  if (!customerName) return { error: "Customer name is required." };
  if (input.screenshot.size === 0) return { error: "Pick a screenshot to upload." };

  let nameMatches = true;
  let pointsAccrued: number | null = null;
  try {
    const analysis = await analyzeGenbluScreenshot(input.screenshot, customerName);
    nameMatches = analysis.nameMatches;
    pointsAccrued = analysis.pointsAccrued;
  } catch {
    nameMatches = true;
  }
  if (!nameMatches) {
    return {
      error: `The name on the screenshot doesn't match "${customerName}" — please check it's the right screenshot and try again.`,
    };
  }

  const ext = input.screenshot.name.split(".").pop() || "jpg";
  const path = `${input.branch}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, input.screenshot, {
    contentType: input.screenshot.type || "image/jpeg",
  });
  if (uploadError) return { error: `Couldn't upload the screenshot: ${uploadError.message}` };

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .select("id, customer_name, points_accrued")
    .eq("branch", input.branch);
  if (fetchError) return { error: fetchError.message };
  const match = (existing ?? []).find((r) => normalizeName(r.customer_name) === normalizeName(customerName));

  if (match) {
    // Each screenshot is proof of one award (points the admin gave the
    // customer on that visit — the "deducted" wording on it is from the
    // admin's own account, not the customer's), not a snapshot of their
    // whole balance. A repeat upload adds to the running total on file
    // instead of replacing it, so points from earlier visits aren't lost.
    // If this screenshot's amount couldn't be read, the total is left as
    // it was rather than being reset to null.
    const newTotal = pointsAccrued === null ? match.points_accrued : (match.points_accrued ?? 0) + pointsAccrued;
    const { error } = await supabaseAdmin
      .from("cc_genblu_registrations")
      .update({ screenshot_path: path, points_accrued: newTotal })
      .eq("id", match.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabaseAdmin.from("cc_genblu_registrations").insert({
      branch: input.branch,
      salesperson_name: user.name,
      salesperson_code: initialsFromName(user.name),
      customer_name: customerName,
      customer_plate_no: input.customerPlateNo.trim(),
      screenshot_path: path,
      points_accrued: pointsAccrued,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/genblu");
  return { updated: true };
}
