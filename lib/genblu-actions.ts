"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { GenbluRegistration, GenbluTransaction } from "./types";
import { BRANCHES, type Branch } from "./branch";
import { extractTextFromImage, extractTextAndWordsFromImage, type PositionedWord } from "./vision";
import { extractGenbluEventWithAi } from "./ai-genblu-extract";
import { logActivity } from "./activity-log";

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

// Looked up fresh by name each time (rather than stored as a link) so
// Point Allocation and GenBlu Register stay two independent tables — this
// only ever updates an existing Tracker entry, never creates one, so a
// points event for someone not yet registered just logs normally with no
// side effect on the Tracker.
async function findMatchingRegistration(
  branch: Branch,
  customerName: string
): Promise<{ id: string; points_accrued: number | null } | null> {
  const { data } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .select("id, customer_name, points_accrued")
    .eq("branch", branch);
  const match = (data ?? []).find((r) => normalizeName(r.customer_name) === normalizeName(customerName));
  return match ? { id: match.id, points_accrued: match.points_accrued } : null;
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

// Two different GenBlu screens can carry a points number, and they mean
// opposite things:
//  - A "Points Accrued" confirmation screen is proof of one award (points
//    given this visit) — that ADDS to whatever's on file.
//  - The app's own home screen — "517 / My Reward Points" (number *before*
//    the label, the large figure above the caption) — is the customer's
//    whole current balance. That REPLACES whatever's on file; adding it
//    would double-count everything earned before this upload.
// The home-screen form requires the fuller "reward points" phrase, not
// just "points", so it doesn't grab an unrelated number (phone number,
// expiry year) sitting near a stray mention of the word "points".
type PointsReading = { value: number; isBalance: boolean };

// The home screen's points card sits directly beside a "membership expires
// on <date>" card — OCR's linear reading order can jumble the two enough
// that the expiry year (e.g. "2028") ends up textually closer to "Reward
// Points" than the real points figure, and a proximity-based text regex
// grabs the year instead. The actual page geometry doesn't lie, though:
// the points number always sits directly above the words "Reward Points"
// in roughly the same column — so when word positions are available, find
// it that way first, and only fall back to a text-only guess when they're
// not (e.g. the Tesseract engine hands back less reliable boxes).
function findPointsAboveLabel(words: PositionedWord[]): number | null {
  const rewardIdx = words.findIndex((w) => /^reward$/i.test(w.text));
  if (rewardIdx === -1) return null;
  const label = words[rewardIdx];
  const numeric = words.filter((w) => /^[\d,]+$/.test(w.text) && w.yCenter < label.yCenter - label.height * 0.3);
  if (numeric.length === 0) return null;
  // Same column as the label first (a big card's number sits above its own
  // caption, not the neighboring card's) — widen to "anything above" only
  // if nothing lines up horizontally.
  const sameColumn = numeric.filter((w) => Math.abs(w.x - label.x) < label.height * 6);
  const pool = sameColumn.length > 0 ? sameColumn : numeric;
  const closest = pool.reduce((a, b) => (b.yCenter > a.yCenter ? b : a));
  const num = Number(closest.text.replace(/,/g, ""));
  return Number.isNaN(num) ? null : num;
}

function extractPointsAccrued(text: string, words: PositionedWord[] = []): PointsReading | null {
  const labeled = text.match(/points[^\d]{0,20}(\d[\d,]{0,6})/i);
  if (labeled) {
    const num = Number(labeled[1].replace(/,/g, ""));
    if (!Number.isNaN(num)) return { value: num, isBalance: false };
  }
  const fromPosition = findPointsAboveLabel(words);
  if (fromPosition !== null) return { value: fromPosition, isBalance: true };

  // Text-only fallback — same expiry-stripping safety net as before, for
  // whenever word positions aren't available at all.
  const withoutExpiry = text.replace(/expir\w*[^\n]{0,60}/gi, "");
  const homeScreen = withoutExpiry.match(/(\d[\d,]{0,6})[^\d]{0,20}reward\s+points/i);
  if (homeScreen) {
    const num = Number(homeScreen[1].replace(/,/g, ""));
    if (!Number.isNaN(num)) return { value: num, isBalance: true };
  }
  return null;
}

// Applies a reading the way its kind requires — set the DB directly to a
// balance reading, or add an award reading on top of whatever's there.
function applyPointsReading(current: number | null, reading: PointsReading | null): number | null {
  if (!reading) return current;
  return reading.isBalance ? reading.value : (current ?? 0) + reading.value;
}

// The GenBlu app screenshot should show the same customer's name — read it
// with the same OCR used for jobsheet scans, check it appears somewhere on
// the screenshot, and pull out the real points balance while we're at it
// (one OCR pass covers both checks).
async function analyzeGenbluScreenshot(
  screenshot: File,
  customerName: string
): Promise<{ nameMatches: boolean; pointsReading: PointsReading | null }> {
  const buffer = Buffer.from(await screenshot.arrayBuffer());
  const base64 = buffer.toString("base64");
  const { text, words } = await extractTextAndWordsFromImage(base64);
  const condensed = condensedName(customerName);
  const nameMatches = !condensed || condensedName(text).includes(condensed);
  return { nameMatches, pointsReading: extractPointsAccrued(text, words) };
}

// The GenBlu app's home screen (used when registering a brand new customer
// with no jobsheet on file to pull a name from) prints the customer's name
// as the very first line, directly above their phone number — anchoring on
// that phone-number line is far more reliable than guessing which of many
// all-caps-looking lines on a busy home screen (menu labels, promo banners)
// is actually the name.
function extractHomeScreenCustomerName(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const isNameLine = (l: string) => /^[A-Za-z][A-Za-z .'-]{1,}$/.test(l);
  const phoneIdx = lines.findIndex((l) => /^\d{2,4}[-\s]\d{3,4}[-\s]\d{3,4}$/.test(l));

  if (phoneIdx > 0) {
    // A long name sometimes wraps across two lines on the app's home
    // screen — walk backward from the phone number, joining every
    // consecutive name-shaped line above it, not just the one right next
    // to it (which grabbed only the first word of a wrapped name).
    const nameLines: string[] = [];
    for (let i = phoneIdx - 1; i >= 0 && nameLines.length < 3 && isNameLine(lines[i]); i--) {
      nameLines.unshift(lines[i]);
    }
    if (nameLines.length > 0) return nameLines.join(" ");
  }

  // Fallback — the name always sits at the very top of this screen, so
  // join whichever of the first few lines look like name text.
  const topNameLines = lines.slice(0, 3).filter(isNameLine);
  return topNameLines.length > 0 ? topNameLines.join(" ") : null;
}

// A short, human-readable preview of whatever points figure OCR found on
// the screenshot — shown to staff so they can see what was read (and catch
// a bad read) instead of the number silently applying itself on submit.
function pointsPreviewText(reading: PointsReading | null): string | null {
  if (!reading) return null;
  return reading.isBalance
    ? `${reading.value.toLocaleString()} points (current balance shown on screen)`
    : `${reading.value.toLocaleString()} points awarded`;
}

// Called as soon as a mechanic picks a screenshot in the "No Jobsheet — New
// Customer" flow, so the name field can fill itself in instead of asking
// staff to retype what's already on the screen they just uploaded — and so
// the points figure that'll be saved is visible up front, not just applied
// silently on submit.
export async function scanGenbluScreenshotForNameAction(
  screenshot: File
): Promise<{ customerName: string | null; pointsPreview: string | null }> {
  await requireApproved();
  try {
    const buffer = Buffer.from(await screenshot.arrayBuffer());
    const base64 = buffer.toString("base64");
    const { text, words } = await extractTextAndWordsFromImage(base64);
    return {
      customerName: extractHomeScreenCustomerName(text),
      pointsPreview: pointsPreviewText(extractPointsAccrued(text, words)),
    };
  } catch {
    return { customerName: null, pointsPreview: null };
  }
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
    const ext = screenshot.name.split(".").pop() || "jpg";
    const path = `${branch}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    // OCR and the storage upload don't depend on each other — run them
    // together instead of waiting for OCR before even starting the upload.
    const [reading, uploadResult] = await Promise.all([
      analyzeGenbluScreenshot(screenshot, customerName)
        .then((a) => a.pointsReading)
        // Points extraction is a bonus, not a requirement — don't block the
        // registration if OCR hiccups.
        .catch(() => null),
      supabaseAdmin.storage.from(BUCKET).upload(path, screenshot, { contentType: screenshot.type || "image/jpeg" }),
    ]);
    if (uploadResult.error) return { error: `Couldn't upload the screenshot: ${uploadResult.error.message}` };
    screenshotPath = path;
    pointsAccrued = applyPointsReading(null, reading);
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
  await logActivity(user, "Added GenBlu registration", `${customerName} (${branch})`);
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
    const ext = input.screenshot.name.split(".").pop() || "jpg";
    const path = `${branch}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    // OCR, the storage upload, and reading the existing points total are
    // all independent of each other — run them together.
    const [reading, uploadResult, existing] = await Promise.all([
      analyzeGenbluScreenshot(input.screenshot, input.customerName)
        .then((a) => a.pointsReading)
        // Points extraction is a bonus, not a requirement — don't block the save.
        .catch(() => null),
      supabaseAdmin.storage.from(BUCKET).upload(path, input.screenshot, { contentType: input.screenshot.type || "image/jpeg" }),
      supabaseAdmin.from("cc_genblu_registrations").select("points_accrued").eq("id", id).single().then((r) => r.data),
    ]);
    if (uploadResult.error) return { error: `Couldn't upload the screenshot: ${uploadResult.error.message}` };
    update.screenshot_path = path;
    update.points_accrued = applyPointsReading(existing?.points_accrued ?? null, reading);
  }

  const { error } = await supabaseAdmin.from("cc_genblu_registrations").update(update).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Updated GenBlu registration", `${input.customerName.trim()} (${branch})`);
  revalidatePath("/genblu");
}

export async function deleteGenbluRegistrationAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: reg } = await supabaseAdmin.from("cc_genblu_registrations").select("customer_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_genblu_registrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Deleted GenBlu registration", `${reg?.customer_name ?? id} (${branch})`);
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
    const ext = screenshot.name.split(".").pop() || "jpg";
    const path = `${input.branch}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    // The name-match check and the storage upload don't depend on each
    // other, so run them together — on a mismatch the upload is simply
    // discarded (its path never gets saved anywhere), same as any other
    // save that fails after the file is already uploaded.
    const [analysis, uploadResult] = await Promise.all([
      analyzeGenbluScreenshot(screenshot, customerName).catch(() => null),
      supabaseAdmin.storage.from(BUCKET).upload(path, screenshot, { contentType: screenshot.type || "image/jpeg" }),
    ]);
    if (uploadResult.error) return { error: `Couldn't upload the GenBlu screenshot: ${uploadResult.error.message}` };
    // If the OCR check itself fails (e.g. Vision hiccup), don't block the
    // registration over it — just skip the verification.
    const nameMatches = analysis?.nameMatches ?? true;
    if (!nameMatches) {
      return {
        error: `The name on the GenBlu screenshot doesn't match "${customerName}" — please check the screenshot is for the right customer and try again.`,
      };
    }
    pointsAccrued = applyPointsReading(null, analysis?.pointsReading ?? null);
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
  await logActivity(user, "Registered GenBlu (from jobsheet)", `${customerName} (${input.branch})`);
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

  const ext = input.screenshot.name.split(".").pop() || "jpg";
  const path = `${input.branch}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  // The name-match check and the storage upload don't depend on each
  // other, so run them together instead of one after the other.
  const [analysis, uploadResult] = await Promise.all([
    analyzeGenbluScreenshot(input.screenshot, customerName).catch(() => null),
    supabaseAdmin.storage.from(BUCKET).upload(path, input.screenshot, { contentType: input.screenshot.type || "image/jpeg" }),
  ]);
  if (uploadResult.error) return { error: `Couldn't upload the screenshot: ${uploadResult.error.message}` };
  const nameMatches = analysis?.nameMatches ?? true;
  if (!nameMatches) {
    return {
      error: `The name on the screenshot doesn't match "${customerName}" — please check it's the right screenshot and try again.`,
    };
  }
  const pointsReading = analysis?.pointsReading ?? null;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .select("id, customer_name, points_accrued")
    .eq("branch", input.branch);
  if (fetchError) return { error: fetchError.message };
  const match = (existing ?? []).find((r) => normalizeName(r.customer_name) === normalizeName(customerName));

  if (match) {
    // A "Points Accrued" award screenshot adds to the running total (proof
    // of one award, not a snapshot of the whole balance) — repeat uploads
    // of that kind shouldn't lose earlier visits' points. A home-screen
    // "My Reward Points" screenshot is the opposite: it's already the
    // customer's whole current balance, straight from the app, so it
    // replaces whatever's on file instead of stacking on top of it — the
    // right way to sync to a customer who already had points before this
    // dashboard existed. If nothing could be read, the total is left as
    // it was rather than being reset to null.
    const newTotal = applyPointsReading(match.points_accrued, pointsReading);
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
      points_accrued: applyPointsReading(null, pointsReading),
    });
    if (error) return { error: error.message };
  }

  await logActivity(user, "Uploaded GenBlu screenshot", `${customerName} (${input.branch})`);
  revalidatePath("/genblu");
  return { updated: true };
}

const TRANSACTIONS_BUCKET = "genblu-screenshots";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// "28 Aug 26" / "28 August 2026" -> "2026-08-28". The naive version of this
// (first "number word number" match anywhere) can accidentally grab the
// phone's own status bar — "12:04" + a misread signal-strength icon + a
// battery "85 %" reads as "04 tall 85", which shape-matches just fine
// until the middle token is checked against real month names. So every
// candidate match is validated in order and the first one with an actual
// month name wins, instead of trusting whichever comes first in the text.
function findDateMatch(text: string): RegExpMatchArray | null {
  for (const match of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})\b/g)) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    const day = Number(match[1]);
    if (month && day >= 1 && day <= 31) return match;
  }
  return null;
}

function extractTransactionDate(text: string): string | null {
  const match = findDateMatch(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The transaction time sits right next to the (validated) date — searching
// from there onward, not the whole text, is what keeps this from grabbing
// the phone's own status-bar clock at the very top of the screenshot.
// The screen prints 12-hour time with an AM/PM suffix ("01:32 PM") — the
// old version only captured the "01:32" and silently dropped the suffix,
// which reads as 1:32 in the morning instead of the afternoon it actually
// was. Stored as 24-hour from here on, so there's no AM/PM to lose later.
function extractTransactionTime(text: string): string | null {
  const dateMatch = findDateMatch(text);
  if (!dateMatch || dateMatch.index === undefined) return null;
  const after = text.slice(dateMatch.index + dateMatch[0].length, dateMatch.index + dateMatch[0].length + 30);
  const timeMatch = after.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!timeMatch) return null;
  let hour = Number(timeMatch[1]);
  const minute = timeMatch[2];
  const meridiem = timeMatch[3]?.toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

// Two different GenBlu screens land here: the instant confirmation right
// after a counter transaction (name is the large header text above
// "Membership number", no label of its own), and the "Transaction Details"
// history screen (name follows an "Awarded to" label, with the membership
// number in parentheses right after it instead of its own line). Each
// extractor below tries the labeled "Awarded to" form first, since it's
// unambiguous, then falls back to the position-based header guess.
function extractTransactionCustomerName(text: string): string {
  const awardedIdx = text.search(/awarded\s*to/i);
  if (awardedIdx !== -1) {
    const after = text.slice(awardedIdx).replace(/awarded\s*to/i, "");
    // One "Transaction Details" layout: name directly followed by "(memberNo)"
    // on the same line.
    const inlineMatch = after.match(/^\s*([A-Za-z][A-Za-z .'/@-]{3,}?)\s*\(/);
    if (inlineMatch) return inlineMatch[1].trim();
    // A second "Transaction Details" layout: name sits on its own line right
    // after "Awarded to", with no parenthesis — the member number instead
    // shows up much further down under a separate "Card used by member"
    // label. Falling through to the length-based guess below picked up
    // whatever nearby line happened to be longest (e.g. "Points deducted on
    // sale of Service"), not the actual name — anchoring on the very next
    // line after "Awarded to" is far more reliable than guessing by length.
    const nextLine = after
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /^[A-Za-z][A-Za-z .'/@-]{3,}$/.test(l));
    if (nextLine) return nextLine;
  }

  const membershipIdx = text.search(/membership\s*number/i);
  const head = membershipIdx > 0 ? text.slice(0, membershipIdx) : text;
  const candidates = head
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[A-Za-z][A-Za-z .'/@-]{3,}$/.test(l));
  if (candidates.length === 0) return "";
  return candidates.reduce((a, b) => (b.length > a.length ? b : a), "");
}

function extractMembershipNumber(text: string): string | null {
  const labeled = text.match(/membership\s*number\D{0,15}(\d[\d-]{4,20})/i);
  if (labeled) return labeled[1];
  // Transaction Details screen: the number sits in parentheses right after
  // the "Awarded to" name instead of its own labeled line.
  const parenMatch = text.match(/awarded\s*to[\s\S]{0,60}?\(\s*(\d[\d-]{4,20})\s*\)/i);
  if (parenMatch) return parenMatch[1];
  // A second Transaction Details layout has no parenthesis at all — the
  // member number is further down under its own "Card used by member" line.
  const cardUsedMatch = text.match(/card\s*used\s*by\s*member\D{0,20}(\d[\d-]{4,20})/i);
  return cardUsedMatch ? cardUsedMatch[1] : null;
}

function extractProductCategory(text: string): string | null {
  const labeled = text.match(/product\s*category\W{0,15}([A-Za-z]{2,20})/i);
  if (labeled) return labeled[1].toUpperCase();
  // Transaction Details screen calls the same thing "Spent categories".
  const spent = text.match(/spent\s*categor(?:y|ies)\W{0,15}([A-Za-z]{2,20})/i);
  return spent ? spent[1].toUpperCase() : null;
}

function extractTransactionPoints(text: string): number | null {
  const match = text.match(/points[^\d]{0,20}(\d[\d,]{0,6})/i);
  if (!match) return null;
  const num = Number(match[1].replace(/,/g, ""));
  // "Points deducted" on this screen means deducted from the store's own
  // allocation budget and given to the customer, not taken away from
  // them — Point Allocation tracks points given out, always positive,
  // regardless of which of the app's screens/wording produced the photo.
  return Number.isNaN(num) ? null : num;
}

type TransactionRow = {
  id: string;
  branch: Branch;
  customer_name: string;
  membership_number: string | null;
  product_category: string | null;
  points: number;
  transaction_date: string | null;
  transaction_time: string | null;
  service_coupon: boolean;
  screenshot_path: string | null;
  uploaded_by: string | null;
  created_at: string;
};

function toTransaction(r: TransactionRow): GenbluTransaction {
  return {
    id: r.id,
    branch: r.branch,
    customerName: r.customer_name,
    membershipNumber: r.membership_number,
    productCategory: r.product_category,
    points: r.points,
    transactionDate: r.transaction_date,
    transactionTime: r.transaction_time,
    serviceCoupon: r.service_coupon,
    screenshotPath: r.screenshot_path,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

// Every field here is read straight off the screenshot — the phone form
// has no manual inputs for these, by design (photo evidence, not typed
// numbers someone could fat-finger or fudge). Branch is the one exception,
// since it never appears on the GenBlu app screen itself.
//
// Deliberately independent of the Tracker (cc_genblu_registrations) —
// auto-linking the two used to also silently create a near-empty Tracker
// entry (no plate number) whenever a transaction's name didn't match an
// existing one, which was especially confusing for a points *deduction*.
// Point Allocation is just this log; GenBlu Register is its own separate
// step from the Tracker tab.
export async function addGenbluTransactionAction(input: {
  branch: Branch;
  screenshot: File;
  serviceCoupon: boolean;
}): Promise<{ error: string; rawText?: string } | { transaction: GenbluTransaction; rawText: string; trackerUpdated: boolean }> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  if (input.screenshot.size === 0) return { error: "Pick a screenshot to upload." };

  const buffer = Buffer.from(await input.screenshot.arrayBuffer());
  const base64 = buffer.toString("base64");
  let text = "";
  try {
    text = await extractTextFromImage(base64);
  } catch {
    return { error: "Couldn't read the screenshot — please try again with a clearer photo." };
  }

  let customerName = extractTransactionCustomerName(text);
  let points = extractTransactionPoints(text);
  let membershipNumber = extractMembershipNumber(text);
  let productCategory = extractProductCategory(text);
  let transactionDate = extractTransactionDate(text);
  let transactionTime = extractTransactionTime(text);

  // The regex extractors above only know the specific GenBlu screens
  // they've been taught — when they can't find a name and points together,
  // fall back to asking an LLM to read the same fields off whatever screen
  // this actually is, so an unfamiliar layout doesn't just fail outright.
  if (!customerName || points === null) {
    const aiResult = await extractGenbluEventWithAi(text).catch(() => null);
    if (aiResult) {
      customerName = aiResult.customerName;
      points = aiResult.points;
      membershipNumber = membershipNumber ?? aiResult.membershipNumber;
      productCategory = productCategory ?? aiResult.productCategory;
      transactionDate = transactionDate ?? aiResult.transactionDate;
      transactionTime = transactionTime ?? aiResult.transactionTime;
    }
  }

  if (!customerName || points === null) {
    return {
      error: "Couldn't read the customer name and points off that screenshot — please try again with a clearer, uncropped photo of the full screen.",
      rawText: text,
    };
  }

  const ext = input.screenshot.name.split(".").pop() || "jpg";
  const path = `${input.branch}/txn-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(TRANSACTIONS_BUCKET).upload(path, input.screenshot, {
    contentType: input.screenshot.type || "image/jpeg",
  });
  if (uploadError) return { error: `Couldn't upload the screenshot: ${uploadError.message}` };

  const { data, error } = await supabaseAdmin
    .from("cc_genblu_transactions")
    .insert({
      branch: input.branch,
      customer_name: customerName,
      membership_number: membershipNumber,
      product_category: productCategory,
      points,
      transaction_date: transactionDate,
      transaction_time: transactionTime,
      service_coupon: input.serviceCoupon,
      screenshot_path: path,
      uploaded_by: user.name,
    })
    .select("*")
    .single();
  if (error) return { error: error.message };

  // Only updates an existing Tracker entry when the name matches one —
  // never creates a new one, so an unregistered customer's award/deduction
  // still logs here without leaving a stray, mostly-empty Tracker card.
  const matchedReg = await findMatchingRegistration(input.branch, customerName);
  if (matchedReg) {
    await supabaseAdmin
      .from("cc_genblu_registrations")
      .update({ points_accrued: Math.max(0, (matchedReg.points_accrued ?? 0) + points) })
      .eq("id", matchedReg.id);
  }

  await logActivity(
    user,
    "Logged GenBlu point allocation",
    `${customerName} — ${points} pts (${input.branch})${matchedReg ? ", Tracker updated" : ""}`
  );
  revalidatePath("/genblu");
  return { transaction: toTransaction(data as TransactionRow), rawText: text, trackerUpdated: !!matchedReg };
}

export async function getGenbluTransactions(branch: Branch): Promise<GenbluTransaction[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_genblu_transactions")
    .select("*")
    .eq("branch", branch)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TransactionRow[]).map(toTransaction);
}

export async function getAllBranchesGenbluTransactions(): Promise<GenbluTransaction[]> {
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getGenbluTransactions(value)));
  return perBranch.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function deleteGenbluTransactionAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: txn } = await supabaseAdmin.from("cc_genblu_transactions").select("customer_name, points").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_genblu_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Mirrors the update that logging this allocation made — same
  // by-name lookup, so deleting a mistaken entry doesn't leave the
  // Tracker total overstated (or understated, for a deduction).
  if (txn) {
    const matchedReg = await findMatchingRegistration(branch, txn.customer_name);
    if (matchedReg) {
      await supabaseAdmin
        .from("cc_genblu_registrations")
        .update({ points_accrued: Math.max(0, (matchedReg.points_accrued ?? 0) - txn.points) })
        .eq("id", matchedReg.id);
    }
  }

  await logActivity(user, "Deleted GenBlu point allocation", `${txn?.customer_name ?? id} — ${txn?.points ?? ""} pts (${branch})`);
  revalidatePath("/genblu");
}

export type GenbluMonthlySummaryRow = { branch: Branch | "unknown"; label: string; counts: number; points: number };

// Matches the admin's own spreadsheet "Finding" table: how many awards and
// how many total points were given this month, split by branch.
export async function getGenbluMonthlySummary(year: number, month: number): Promise<{ rows: GenbluMonthlySummaryRow[]; total: GenbluMonthlySummaryRow }> {
  await requireApproved();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const { data, error } = await supabaseAdmin
    .from("cc_genblu_transactions")
    .select("branch, points, transaction_date")
    .gte("transaction_date", `${prefix}-01`)
    .lt("transaction_date", month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`);
  if (error) throw new Error(error.message);

  const byBranch = new Map<Branch, { counts: number; points: number }>();
  for (const b of BRANCHES) byBranch.set(b.value, { counts: 0, points: 0 });
  const total = { counts: 0, points: 0 };
  for (const row of data ?? []) {
    const entry = byBranch.get(row.branch as Branch);
    if (entry) {
      entry.counts += 1;
      entry.points += Number(row.points);
    }
    total.counts += 1;
    total.points += Number(row.points);
  }

  const rows: GenbluMonthlySummaryRow[] = BRANCHES.map((b) => ({
    branch: b.value,
    label: b.label,
    counts: byBranch.get(b.value)!.counts,
    points: byBranch.get(b.value)!.points,
  }));
  return { rows, total: { branch: "unknown", label: "Total", counts: total.counts, points: total.points } };
}
