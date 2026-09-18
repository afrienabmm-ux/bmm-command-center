"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, requireManagement, assertCanEditBranch, getActiveBranchSelection } from "./current-user";
import { logActivity } from "./activity-log";
import { todayInMalaysia, daysSinceInMalaysia } from "./malaysia-time";
import type { RepairJob, RepairJobItem, RepairStatus, JobType, ApprovalStatus, QcResult } from "./types";
import { BRANCHES, type Branch } from "./branch";
import { normalizeName } from "./name-matching";
import { checkCustomerCode, customerCodeReason } from "./customer-code";
import { normalizePlate } from "./plate";
import { getGenbluPlates } from "./genblu-actions";

type ItemRow = { id: string; code: string; description: string; quantity: number; price: number };

// Short branch code used in generated job numbers (RJ-HQ-0001, etc.) —
// Kapar is HQ rather than KAPAR since it's the head office, distinct from
// the branch value itself.
const JOB_NO_BRANCH_CODE: Record<Branch, string> = { kapar: "HQ", puncak_alam: "PA", setia_alam: "ST" };

// A Walk-in job number comes straight off the printed jobsheet, so two rows
// with the same number at the same branch means the same physical jobsheet
// got saved twice — most often a re-scan after the page seemed to hang.
async function findDuplicateJobNo(branch: Branch, jobNo: string, excludeId?: string): Promise<boolean> {
  let query = supabaseAdmin
    .from("cc_repair_jobs")
    .select("id", { count: "exact", head: true })
    .eq("branch", branch)
    .eq("job_no", jobNo);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

type Row = {
  id: string;
  branch: Branch;
  job_no: string;
  customer_name: string;
  customer_phone: string;
  plate_no: string;
  job_type: JobType;
  mechanic_id: string | null;
  description: string;
  status: RepairStatus;
  revenue_amount: number;
  deal_type: string;
  started_date: string | null;
  completed_date: string | null;
  created_at: string;
  form_date: string | null;
  pic_name: string;
  model: string;
  bike_year: string;
  condition: string;
  location: string;
  stock_order_date: string | null;
  stock_arrive_date: string | null;
  prepared_by: string;
  approval_status: ApprovalStatus;
  is_big_item: boolean;
  customer_code: string;
  colour: string;
  engine_no: string;
  chassis_no: string;
  jobsheet_no: string;
  sales_no: string;
  sales_date: string;
  warranty_card_no: string;
  mileage_km: string;
  next_mileage_km: string;
  service_type: string;
  next_service_date: string;
  jobsheet_user_id: string;
  image_paths: string[] | null;
  arrived_date: string | null;
  quotation_date: string | null;
  qc_result: QcResult | null;
  qc_date: string | null;
  qc_fail_reason: string | null;
  qc_fail_followup_date: string | null;
  signature_status: string;
  signature_issue_resolved: boolean;
  jobsheet_photo_path: string | null;
  remark: string;
  genblu_asked: boolean;
  cc_repair_job_items: ItemRow[] | null;
};

function toJob(r: Row, genbluPlates: Set<string>): RepairJob {
  return {
    id: r.id,
    branch: r.branch,
    jobNo: r.job_no,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    plateNo: r.plate_no,
    jobType: r.job_type,
    mechanicId: r.mechanic_id,
    description: r.description,
    status: r.status,
    revenueAmount: Number(r.revenue_amount),
    dealType: r.deal_type,
    startedDate: r.started_date,
    completedDate: r.completed_date,
    createdAt: r.created_at,
    formDate: r.form_date,
    picName: r.pic_name,
    model: r.model,
    bikeYear: r.bike_year,
    condition: r.condition,
    location: r.location,
    items: (r.cc_repair_job_items ?? []).map((i): RepairJobItem => ({
      id: i.id,
      code: i.code,
      description: i.description,
      quantity: Number(i.quantity),
      price: Number(i.price),
    })),
    stockOrderDate: r.stock_order_date,
    stockArriveDate: r.stock_arrive_date,
    preparedBy: r.prepared_by,
    approvalStatus: r.approval_status,
    isBigItem: r.is_big_item,
    customerCode: r.customer_code,
    colour: r.colour,
    engineNo: r.engine_no,
    chassisNo: r.chassis_no,
    jobsheetNo: r.jobsheet_no,
    salesNo: r.sales_no,
    salesDate: r.sales_date,
    warrantyCardNo: r.warranty_card_no,
    mileageKm: r.mileage_km,
    nextMileageKm: r.next_mileage_km,
    serviceType: r.service_type,
    nextServiceDate: r.next_service_date,
    jobsheetUserId: r.jobsheet_user_id,
    imagePaths: r.image_paths ?? [],
    arrivedDate: r.arrived_date,
    quotationDate: r.quotation_date,
    qcResult: r.qc_result,
    qcDate: r.qc_date,
    qcFailReason: r.qc_fail_reason,
    qcFailFollowupDate: r.qc_fail_followup_date,
    signatureStatus: r.signature_status,
    signatureIssueResolved: r.signature_issue_resolved,
    jobsheetPhotoPath: r.jobsheet_photo_path,
    remark: r.remark,
    genbluAsked: r.genblu_asked,
    hasGenblu: genbluPlates.has(normalizePlate(r.plate_no ?? "")),
  };
}

// Walk-in jobs still need a mechanic picked up front; Restore Bike jobs
// don't — they start in the Main Listing with just the bike's details,
// and get a mechanic later via the Restore Bike tab's Assign button.
// Whenever a mechanic IS provided, though, the same rules apply either
// way: a mechanic can only carry one active (non-Completed, non-QC) job
// at a time, and heavy jobs (manually flagged as a big item via the "Big
// / heavy item repair" checkbox) can only go to mechanics in the "Heavy
// Repair" category. Enforced server-side so it can't be bypassed even if
// the UI's own filtering is stale.
//
// Returns { error } instead of throwing — a thrown Error from a Server
// Action gets mangled into an unhelpful "Minified React error #441" on the
// client in production builds, instead of surfacing the message.
async function assertMechanicAssignment(
  mechanicId: string | null,
  isBigItem: boolean,
  excludeJobId?: string,
  required = true
): Promise<{ error: string } | void> {
  if (!mechanicId) {
    if (required) return { error: "A mechanic must be assigned to this job." };
    return;
  }

  const { data: mechanic, error: mechError } = await supabaseAdmin
    .from("cc_mechanics")
    .select("category")
    .eq("id", mechanicId)
    .single();
  if (mechError) return { error: mechError.message };

  if (isBigItem && mechanic.category !== "Heavy Repair") {
    return { error: "This is a heavy repair job — it can only be assigned to a Heavy Repair mechanic." };
  }
}

const SELECT_WITH_ITEMS = "*, cc_repair_job_items(*)";

// Completed and QC jobs are excluded here so they automatically drop off
// the active list — Completed because it's done, QC because it's now
// waiting on the branch PIC rather than the mechanic. Memoized per
// request: the dashboard asks for the same branch's active jobs twice
// (branch breakdown, then the overdue check).
const cachedActiveRepairJobs = cache(async (branch: Branch): Promise<RepairJob[]> => {
  const [{ data, error }, genbluPlateList] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select(SELECT_WITH_ITEMS)
      .eq("branch", branch)
      .not("status", "in", '("Completed","QC")')
      .order("started_date", { ascending: false }),
    getGenbluPlates(),
  ]);
  if (error) throw new Error(error.message);
  const genbluPlates = new Set(genbluPlateList);
  return (data as unknown as Row[]).map((r) => toJob(r, genbluPlates));
});

export async function getActiveRepairJobs(branch: Branch): Promise<RepairJob[]> {
  await requireApproved();
  return cachedActiveRepairJobs(branch);
}

// Active jobs across all 3 branches — used to know which mechanics are
// already busy, regardless of which single branch the page is viewing.
export async function getAllBranchesActiveRepairJobs(): Promise<RepairJob[]> {
  await requireApproved();
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => cachedActiveRepairJobs(value)));
  return perBranch.flat();
}

export async function getCompletedRepairJobs(branch: Branch): Promise<RepairJob[]> {
  await requireApproved();
  const [{ data, error }, genbluPlateList] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select(SELECT_WITH_ITEMS)
      .eq("branch", branch)
      .eq("status", "Completed")
      .order("completed_date", { ascending: false })
      .limit(200),
    getGenbluPlates(),
  ]);
  if (error) throw new Error(error.message);
  const genbluPlates = new Set(genbluPlateList);
  return (data as unknown as Row[]).map((r) => toJob(r, genbluPlates));
}

// Completed jobs across all 3 branches — for the "All Branches" view.
export async function getAllBranchesCompletedRepairJobs(): Promise<RepairJob[]> {
  await requireApproved();
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getCompletedRepairJobs(value)));
  return perBranch.flat().sort((a, b) => (b.completedDate ?? "").localeCompare(a.completedDate ?? ""));
}

// The Jobsheet page only ever loads each branch's most recent 200
// completed jobs to the browser (see getCompletedRepairJobs above) — an
// older completed job that's since been pushed out of that window can't
// be found by filtering what's already loaded, no matter what's typed
// into the search box. This hits the database directly instead, so a
// search always finds a match regardless of how old it is or which
// tab/date range happens to be selected.
export async function searchWalkInJobsAction(query: string): Promise<RepairJob[]> {
  const user = await requireApproved();
  const q = query.trim().replace(/[,()]/g, "");
  if (q.length < 2) return [];
  const branchSelection = await getActiveBranchSelection(user);

  let dbQuery = supabaseAdmin
    .from("cc_repair_jobs")
    .select(SELECT_WITH_ITEMS)
    .eq("job_type", "Walk-in")
    .or(`job_no.ilike.%${q}%,jobsheet_no.ilike.%${q}%,customer_name.ilike.%${q}%,plate_no.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (branchSelection !== "all") dbQuery = dbQuery.eq("branch", branchSelection);

  const [{ data, error }, genbluPlateList] = await Promise.all([dbQuery, getGenbluPlates()]);
  if (error) throw new Error(error.message);
  const genbluPlates = new Set(genbluPlateList);
  return (data as unknown as Row[]).map((r) => toJob(r, genbluPlates));
}

// Looked up by id alone (no branch filter) — used by the full-page edit
// route, which only has the job id from the URL.
export async function getRepairJobById(id: string): Promise<RepairJob | null> {
  await requireApproved();
  const [{ data, error }, genbluPlateList] = await Promise.all([
    supabaseAdmin.from("cc_repair_jobs").select(SELECT_WITH_ITEMS).eq("id", id).maybeSingle(),
    getGenbluPlates(),
  ]);
  if (error) throw new Error(error.message);
  return data ? toJob(data as unknown as Row, new Set(genbluPlateList)) : null;
}

export type ServiceReminder = {
  id: string;
  branch: Branch;
  customerName: string;
  customerPhone: string;
  plateNo: string;
  model: string;
  nextServiceDate: string;
  daysUntil: number;
};

// Walk-in customers whose next service date (from the jobsheet) is within
// 7 days — including ones already past due, so the branch still sees them
// until a new jobsheet is filled in with a fresh date. Not tied to job
// status, since Walk-in jobs go straight to Completed on creation.
export async function getUpcomingServiceReminders(onlyBranch?: Branch): Promise<ServiceReminder[]> {
  await requireApproved();
  const branches = onlyBranch ? [onlyBranch] : BRANCHES.map((b) => b.value);
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("id, branch, customer_name, customer_phone, plate_no, model, next_service_date")
    .eq("job_type", "Walk-in")
    .in("branch", branches)
    .neq("next_service_date", "");
  if (error) throw new Error(error.message);

  const today = todayInMalaysia();

  return (data ?? [])
    .map((r) => {
      const nextServiceDate = r.next_service_date as string;
      return {
        id: r.id as string,
        branch: r.branch as Branch,
        customerName: r.customer_name as string,
        customerPhone: r.customer_phone as string,
        plateNo: r.plate_no as string,
        model: r.model as string,
        nextServiceDate,
        // Negative once the service is overdue — those stay in the list
        // (they need chasing most), which the <= 7 cutoff below preserves.
        daysUntil: daysSinceInMalaysia(today, nextServiceDate),
      };
    })
    .filter((j) => Number.isFinite(Date.parse(`${j.nextServiceDate.slice(0, 10)}T00:00:00Z`)) && j.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export type SuspiciousJob = {
  id: string;
  branch: Branch;
  jobNo: string;
  customerName: string;
  plateNo: string;
  revenueAmount: number;
  startedDate: string | null;
  reasons: string[];
};

// RM — a normal Walk-in job (oil, small parts, labour) rarely reaches
// this on its own; one that does is worth a second look, not necessarily
// wrong.
const SUSPICIOUS_REVENUE_THRESHOLD = 1000;

// Plain, explainable red flags a GM can actually act on by opening the
// job and checking — deliberately not a fuzzy "anomaly score". Bounded to
// the last 3 months (this runs on every dashboard load, for whoever's
// allowed to see it) — a year-old data problem isn't "check this today"
// material.
export async function getSuspiciousWalkInJobs(onlyBranch?: Branch): Promise<SuspiciousJob[]> {
  await requireApproved();
  const branches = onlyBranch ? [onlyBranch] : BRANCHES.map((b) => b.value);
  const today = todayInMalaysia();
  const [y, m, d] = today.split("-").map(Number);
  const sinceDate = new Date(y, m - 1 - 3, d).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("id, branch, job_no, customer_name, plate_no, revenue_amount, started_date, mechanic_id, created_at, suspicious_dismissed_at")
    .eq("job_type", "Walk-in")
    .in("branch", branches)
    .gte("created_at", sinceDate)
    .is("suspicious_dismissed_at", null);
  if (error) throw new Error(error.message);

  const flagged: SuspiciousJob[] = [];
  for (const r of data ?? []) {
    const revenue = Number(r.revenue_amount);
    const reasons: string[] = [];
    if (revenue > SUSPICIOUS_REVENUE_THRESHOLD) reasons.push(`Cost RM ${revenue.toLocaleString()} — unusually high`);
    if (!r.started_date) reasons.push("Job Date not set");
    if (!r.mechanic_id) reasons.push("No mechanic assigned");
    if (!(r.customer_name as string)?.trim()) reasons.push("Customer name missing");
    if (!(r.plate_no as string)?.trim()) reasons.push("Plate number missing");
    if (reasons.length === 0) continue;
    flagged.push({
      id: r.id as string,
      branch: r.branch as Branch,
      jobNo: r.job_no as string,
      customerName: r.customer_name as string,
      plateNo: r.plate_no as string,
      revenueAmount: revenue,
      startedDate: r.started_date as string | null,
      reasons,
    });
  }
  return flagged.sort((a, b) => b.revenueAmount - a.revenueAmount);
}

// Called when a job is opened from the "worth a second look" banner —
// treated as the reviewer having checked it and found it fine, so it
// shouldn't keep coming back on every future visit.
export async function dismissSuspiciousJobAction(jobId: string): Promise<void> {
  await requireApproved();
  const { error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .update({ suspicious_dismissed_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

type ItemInput = { code?: string; description: string; quantity: number; price: number };

function itemsTotal(items: ItemInput[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.price, 0);
}

async function replaceJobItems(jobId: string, items: ItemInput[]): Promise<void> {
  const { error: delError } = await supabaseAdmin.from("cc_repair_job_items").delete().eq("job_id", jobId);
  if (delError) throw new Error(delError.message);
  if (items.length === 0) return;
  const { error: insError } = await supabaseAdmin.from("cc_repair_job_items").insert(
    items.map((item, i) => ({
      job_id: jobId,
      code: item.code ?? "",
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      sort_order: i,
    }))
  );
  if (insError) throw new Error(insError.message);
}

function countItemCodes(items: ItemInput[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const code = item.code?.trim();
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

// Deducts 1 unit of stock per newly-added item row whose code matches a
// catalog product — a part used on a job comes out of that branch's shelf
// count. Only the net increase per code is deducted, so re-saving a job
// without adding rows doesn't deduct again, and removing a row doesn't
// silently restock (no evidence the part was actually returned).
async function deductCatalogStockForNewItems(branch: Branch, oldItems: ItemInput[], newItems: ItemInput[]): Promise<void> {
  const oldCounts = countItemCodes(oldItems);
  const newCounts = countItemCodes(newItems);
  const codes = [...new Set([...oldCounts.keys(), ...newCounts.keys()])];

  // Each code touches its own catalog product/stock row, so every code's
  // read-then-write chain is independent — running them one code at a
  // time made a 6-part jobsheet wait out 18 round trips back to back.
  await Promise.all(
    codes.map(async (code) => {
      const delta = (newCounts.get(code) ?? 0) - (oldCounts.get(code) ?? 0);
      if (delta <= 0) return;

      const { data: product } = await supabaseAdmin.from("cc_catalog_products").select("id").eq("code", code).maybeSingle();
      if (!product) return;

      const { data: stockRow } = await supabaseAdmin
        .from("cc_catalog_stock")
        .select("quantity")
        .eq("product_id", product.id)
        .eq("branch", branch)
        .maybeSingle();
      const nextQuantity = Math.max(0, (stockRow?.quantity ?? 0) - delta);
      await supabaseAdmin
        .from("cc_catalog_stock")
        .upsert(
          { product_id: product.id, branch, quantity: nextQuantity, updated_at: new Date().toISOString() },
          { onConflict: "product_id,branch" }
        );
    })
  );
}

export async function addRepairJobAction(input: {
  branch: Branch;
  customerName: string;
  customerPhone?: string;
  plateNo: string;
  jobType: JobType;
  mechanicId: string | null;
  description: string;
  revenueAmount: number;
  dealType: string;
  // Required for Walk-in (its form always supplies one). Restore Bike
  // omits it — startedDate stays null until the workflow "Start" stage is
  // clicked, gated on approval.
  startedDate?: string | null;
  // Restore Bike only — the date the PIC filled in this form, independent
  // of startedDate.
  formDate?: string | null;
  picName?: string;
  model?: string;
  bikeYear?: string;
  condition?: string;
  location?: string;
  items?: ItemInput[];
  arrivedDate?: string | null;
  stockOrderDate?: string | null;
  stockArriveDate?: string | null;
  completedDate?: string | null;
  preparedBy?: string;
  isBigItem?: boolean;
  customerCode?: string;
  colour?: string;
  engineNo?: string;
  chassisNo?: string;
  jobsheetNo?: string;
  salesNo?: string;
  salesDate?: string;
  warrantyCardNo?: string;
  mileageKm?: string;
  nextMileageKm?: string;
  serviceType?: string;
  nextServiceDate?: string;
  jobsheetUserId?: string;
  // Restore Bike only — filling in and saving the form counts as the
  // quotation being done, no separate click needed.
  quotationDate?: string | null;
  signatureStatus?: string;
  jobsheetPhotoPath?: string | null;
}): Promise<{ error: string } | { id: string }> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const items = input.items ?? [];
  const assignmentCheck = await assertMechanicAssignment(input.mechanicId, input.isBigItem ?? false, undefined, true);
  if (assignmentCheck && "error" in assignmentCheck) return assignmentCheck;

  // Walk-in jobs carry their own job number from the paper jobsheet
  // (scanned or typed into "Job No. (jobsheet)") — use that as the job's
  // job_no directly instead of an auto-generated one, so the number shown
  // everywhere in the app matches the physical job card. Restore Bike has
  // no such source, so it always gets the auto-generated RJ-{code}-#### one.
  const scannedJobNo = input.jobType === "Walk-in" ? input.jobsheetNo?.trim() : undefined;
  if (scannedJobNo && (await findDuplicateJobNo(input.branch, scannedJobNo))) {
    return {
      error: `Job number ${scannedJobNo} is already saved at this branch — check whether this jobsheet was already added before saving it again.`,
    };
  }
  let jobNo = scannedJobNo;
  if (!jobNo) {
    const { count } = await supabaseAdmin
      .from("cc_repair_jobs")
      .select("*", { count: "exact", head: true })
      .eq("branch", input.branch);
    jobNo = `RJ-${JOB_NO_BRANCH_CODE[input.branch]}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  }
  const revenueAmount = items.length > 0 ? itemsTotal(items) : input.revenueAmount;

  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .insert({
      branch: input.branch,
      job_no: jobNo,
      customer_name: input.customerName,
      customer_phone: input.customerPhone ?? "",
      plate_no: input.plateNo,
      job_type: input.jobType,
      mechanic_id: input.mechanicId,
      description: input.description,
      revenue_amount: revenueAmount,
      deal_type: input.dealType,
      started_date: input.startedDate ?? null,
      form_date: input.formDate ?? null,
      status: input.jobType === "Walk-in" && input.completedDate ? "Completed" : "Pending",
      pic_name: input.picName ?? "",
      model: input.model ?? "",
      bike_year: input.bikeYear ?? "",
      condition: input.condition ?? "",
      location: input.location ?? "",
      arrived_date: input.arrivedDate ?? null,
      stock_order_date: input.stockOrderDate ?? null,
      stock_arrive_date: input.stockArriveDate ?? null,
      completed_date: input.completedDate ?? null,
      prepared_by: input.preparedBy ?? "",
      is_big_item: input.isBigItem ?? false,
      customer_code: input.customerCode ?? "",
      colour: input.colour ?? "",
      engine_no: input.engineNo ?? "",
      chassis_no: input.chassisNo ?? "",
      jobsheet_no: input.jobsheetNo ?? "",
      sales_no: input.salesNo ?? "",
      sales_date: input.salesDate ?? "",
      warranty_card_no: input.warrantyCardNo ?? "",
      mileage_km: input.mileageKm ?? "",
      next_mileage_km: input.nextMileageKm ?? "",
      service_type: input.serviceType ?? "",
      next_service_date: input.nextServiceDate ?? "",
      jobsheet_user_id: input.jobsheetUserId ?? "",
      quotation_date: input.quotationDate ?? null,
      signature_status: input.signatureStatus ?? "",
      jobsheet_photo_path: input.jobsheetPhotoPath ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items.length > 0) {
    await replaceJobItems(data.id, items);
    await deductCatalogStockForNewItems(input.branch, [], items);
  }
  await logActivity(user, `Added ${input.jobType} job`, `${jobNo} — ${input.customerName || input.plateNo} (${input.branch})`);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
  revalidatePath("/catalog");
  return { id: data.id };
}

// Keeps a customer's GenBlu Tracker registration (and their name on any
// Point Allocation entries already logged) matching the jobsheet after a
// PIC fixes a typo'd name or corrects a plate number there — without this,
// a GenBlu record created off the old, wrong value would just keep
// showing it forever, with no way to fix it short of also editing GenBlu
// directly. Matched on the OLD name only, and only exactly (not the
// looser namesLikelyMatch used elsewhere) — this WRITES the match's name,
// so a wrong pick here would silently rename an unrelated customer, a
// worse outcome than just skipping a sync this loose match can't be sure
// about. Best-effort: the jobsheet edit itself has already succeeded by
// the time this runs, so a lookup failure here shouldn't undo that.
async function syncGenbluCustomerDetails(
  branch: Branch,
  oldCustomerName: string,
  newCustomerName: string,
  newPlateNo: string
): Promise<void> {
  try {
    const oldName = normalizeName(oldCustomerName);
    if (!oldName) return;

    const { data: reg } = await supabaseAdmin
      .from("cc_genblu_registrations")
      .select("id, customer_name, customer_plate_no")
      .eq("branch", branch);
    const matchedReg = (reg ?? []).find((r) => normalizeName(r.customer_name) === oldName);
    if (matchedReg && (matchedReg.customer_name !== newCustomerName || matchedReg.customer_plate_no !== newPlateNo)) {
      await supabaseAdmin
        .from("cc_genblu_registrations")
        .update({ customer_name: newCustomerName, customer_plate_no: newPlateNo })
        .eq("id", matchedReg.id);
    }

    if (oldName !== normalizeName(newCustomerName)) {
      const { data: txns } = await supabaseAdmin
        .from("cc_genblu_transactions")
        .select("id, customer_name")
        .eq("branch", branch);
      const matchedTxnIds = (txns ?? []).filter((t) => normalizeName(t.customer_name) === oldName).map((t) => t.id);
      if (matchedTxnIds.length > 0) {
        await supabaseAdmin.from("cc_genblu_transactions").update({ customer_name: newCustomerName }).in("id", matchedTxnIds);
      }
    }
  } catch {
    // Non-fatal — the jobsheet save itself already succeeded.
  }
}

export async function updateRepairJobAction(
  id: string,
  branch: Branch,
  input: {
    // Whether a mechanic is required before saving depends on job type —
    // see assertMechanicAssignment.
    jobType: JobType;
    customerName: string;
    customerPhone?: string;
    plateNo: string;
    mechanicId: string | null;
    description: string;
    revenueAmount: number;
    dealType: string;
    // Omit for Restore Bike so the update doesn't touch the workflow-driven
    // value; Walk-in always supplies one.
    startedDate?: string | null;
    formDate?: string | null;
    picName?: string;
    model?: string;
    bikeYear?: string;
    condition?: string;
    location?: string;
    items?: ItemInput[];
    arrivedDate?: string | null;
    stockOrderDate?: string | null;
    stockArriveDate?: string | null;
    completedDate?: string | null;
    preparedBy?: string;
    isBigItem?: boolean;
    customerCode?: string;
    colour?: string;
    engineNo?: string;
    chassisNo?: string;
    jobsheetNo?: string;
    salesNo?: string;
    salesDate?: string;
    warrantyCardNo?: string;
    mileageKm?: string;
    nextMileageKm?: string;
    serviceType?: string;
    nextServiceDate?: string;
    jobsheetUserId?: string;
    // Restore Bike only — omitted for Walk-in so its updates never touch
    // this column.
    quotationDate?: string | null;
    signatureStatus?: string;
    jobsheetPhotoPath?: string | null;
  }
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const items = input.items ?? [];
  const assignmentCheck = await assertMechanicAssignment(input.mechanicId, input.isBigItem ?? false, id, true);
  if (assignmentCheck && "error" in assignmentCheck) return assignmentCheck;
  const revenueAmount = items.length > 0 ? itemsTotal(items) : input.revenueAmount;

  const { data: existingItems } = await supabaseAdmin
    .from("cc_repair_job_items")
    .select("code, description, quantity, price")
    .eq("job_id", id);

  // Read before the update below overwrites them — needed to look up this
  // customer's GenBlu records by their OLD name/plate (see
  // syncGenbluCustomerDetails after the save) and to know whether either
  // actually changed at all.
  const { data: priorJob } = await supabaseAdmin.from("cc_repair_jobs").select("customer_name, plate_no").eq("id", id).single();

  const update: Record<string, unknown> = {
    customer_name: input.customerName,
    customer_phone: input.customerPhone ?? "",
    plate_no: input.plateNo,
    mechanic_id: input.mechanicId,
    description: input.description,
    revenue_amount: revenueAmount,
    deal_type: input.dealType,
    started_date: input.startedDate,
    form_date: input.formDate,
    pic_name: input.picName ?? "",
    model: input.model ?? "",
    bike_year: input.bikeYear ?? "",
    condition: input.condition ?? "",
    location: input.location ?? "",
    arrived_date: input.arrivedDate ?? null,
    completed_date: input.completedDate,
    prepared_by: input.preparedBy ?? "",
    is_big_item: input.isBigItem ?? false,
    customer_code: input.customerCode ?? "",
    colour: input.colour ?? "",
    engine_no: input.engineNo ?? "",
    chassis_no: input.chassisNo ?? "",
    jobsheet_no: input.jobsheetNo ?? "",
    sales_no: input.salesNo ?? "",
    sales_date: input.salesDate ?? "",
    warranty_card_no: input.warrantyCardNo ?? "",
    mileage_km: input.mileageKm ?? "",
    next_mileage_km: input.nextMileageKm ?? "",
    service_type: input.serviceType ?? "",
    next_service_date: input.nextServiceDate ?? "",
    jobsheet_user_id: input.jobsheetUserId ?? "",
  };
  // Keep the displayed job number in sync if the PIC edits/re-scans the
  // jobsheet's own Job No. field after the job was created.
  if (input.jobType === "Walk-in" && input.jobsheetNo?.trim()) {
    const newJobNo = input.jobsheetNo.trim();
    if (await findDuplicateJobNo(branch, newJobNo, id)) {
      return { error: `Job number ${newJobNo} is already saved at this branch — check whether this jobsheet was already added before saving it again.` };
    }
    update.job_no = newJobNo;
  }
  if (input.quotationDate !== undefined) update.quotation_date = input.quotationDate;
  if (input.signatureStatus !== undefined) update.signature_status = input.signatureStatus;
  // A re-scan on an existing job replaces the saved photo with the new
  // one; leaving it untouched (undefined) when the form wasn't re-scanned
  // is what keeps a job's original photo from being wiped out on every
  // ordinary edit.
  if (input.jobsheetPhotoPath !== undefined) update.jobsheet_photo_path = input.jobsheetPhotoPath;
  // Stock Order/Arrive are click-to-stamp only on the Bikes Listing list now
  // (setRestoreBikeWorkflowDateAction) — the edit form no longer sends
  // these, so omitting them here must NOT silently null out a date already
  // stamped from the list.
  if (input.stockOrderDate !== undefined) update.stock_order_date = input.stockOrderDate;
  if (input.stockArriveDate !== undefined) update.stock_arrive_date = input.stockArriveDate;
  // Walk-in jobs have no separate QC stage — setting the End Date from the
  // edit form (desktop or the phone /scan page) marks the job Completed the
  // same way the list's click-to-stamp End Date button does, so the PIC
  // never has to open the dashboard separately just to flip the status.
  if (input.jobType === "Walk-in") {
    update.status = input.completedDate ? "Completed" : "Pending";
  }

  const { error } = await supabaseAdmin.from("cc_repair_jobs").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  await replaceJobItems(id, items);
  await deductCatalogStockForNewItems(branch, (existingItems as ItemInput[] | null) ?? [], items);
  // A GenBlu Tracker/Allocation record is created from whatever name and
  // plate the jobsheet had at that moment — if the PIC later fixes a typo
  // here, those records should follow, not keep showing the stale value
  // forever with no way to correct it short of editing GenBlu directly too.
  if (input.jobType === "Walk-in" && priorJob && (priorJob.customer_name !== input.customerName || priorJob.plate_no !== input.plateNo)) {
    await syncGenbluCustomerDetails(branch, priorJob.customer_name, input.customerName, input.plateNo);
  }
  await logActivity(user, `Updated ${input.jobType} job`, `${input.customerName || input.plateNo} (${branch})`);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
  revalidatePath("/genblu");
  revalidatePath("/catalog");
  revalidatePath("/");
}

// Click-to-stamp confirmation that the PIC actually looked into why the
// bike failed QC — required before the repair can be re-submitted to QC
// (see the "completed" stage check in setRestoreBikeWorkflowDateAction),
// so a failure reason can't just sit there unaddressed. Same toggle
// behaviour as the other workflow stamps: clicking again un-stamps it.
// Walk-in only — Management clears a flagged "no signature detected" job
// after checking the actual jobsheet photo and confirming a signature
// really is on it. Gated to Management (not just assertCanEditBranch)
// since the whole point is a second set of eyes above whoever saved the
// job in the first place.
export async function resolveSignatureIssueAction(id: string, branch: Branch): Promise<{ error: string } | void> {
  const user = await requireManagement();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ signature_issue_resolved: true }).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Confirmed jobsheet signature", `job ${id}`);
  revalidatePath("/repairs/walk-in");
}

// Click-to-stamp End Date for Walk-in jobs — status isn't a manual choice
// here, it just follows the date: stamping it marks the job Completed,
// clearing it puts the job back to Pending.
export async function setWalkInEndDateAction(id: string, branch: Branch, date: string | null): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .update({ completed_date: date, status: date ? "Completed" : "Pending" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Set Walk-in End Date", `job ${id} → ${date ?? "cleared"}`);
  revalidatePath("/repairs/walk-in");
  revalidatePath("/");
}

// Click-to-stamp "asked about GenBlu" for a Walk-in job — a plain manual
// flag, not tied to whether a registration has actually come in (that's
// hasGenblu, computed separately from cc_genblu_registrations). Clicking
// again un-stamps it, same toggle behaviour as the other workflow stamps.
export async function setGenbluAskedAction(id: string, branch: Branch, asked: boolean): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ genblu_asked: asked }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Set GenBlu asked", `job ${id} → ${asked}`);
  revalidatePath("/repairs/walk-in");
}

export async function deleteRepairJobAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { data: job } = await supabaseAdmin.from("cc_repair_jobs").select("job_no, customer_name, plate_no").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_repair_jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Deleted job", `${job?.job_no ?? id} — ${job?.customer_name || job?.plate_no || ""} (${branch})`);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
  revalidatePath("/");
}

const JOBSHEET_PHOTO_BUCKET = "jobsheet-photos";

// The original photo of the paper jobsheet, uploaded through Scan
// Jobsheet — same private-bucket-plus-signed-URL pattern as Restore Bike
// photos. Lets a manager check the real thing directly whenever the
// automated reading (item rows, signature check) needs a human
// double-check.
export async function getJobsheetPhotoUrlAction(path: string): Promise<string | null> {
  await requireApproved();
  const { data, error } = await supabaseAdmin.storage.from(JOBSHEET_PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export type CustomerCodeErrorRow = {
  id: string;
  branch: Branch;
  date: string;
  jobsheetNo: string;
  mechanic: string;
  reason: string;
  district: string;
  icNumber: string;
  plateNo: string;
  customerName: string;
  model: string;
};

// Every Walk-in job, across every branch and all of history, whose
// Customer Code isn't a real 12-digit IC — the retroactive counterpart to
// the warning shown live on the jobsheet form (lib/customer-code.ts is the
// one shared rule both sides use, so they never disagree). "District" is
// always left blank, matching the branches' own manually-kept sheet this
// report replaces. Mechanic shows just the short code (not the full name)
// for the same reason — that sheet's "Mechanic Code" column only ever held
// the code.
export async function getCustomerCodeErrors(): Promise<CustomerCodeErrorRow[]> {
  await requireApproved();
  const [{ data: jobs, error: jobsErr }, { data: mechanics, error: mechErr }] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("id, branch, jobsheet_no, job_no, started_date, created_at, customer_code, customer_name, plate_no, model, mechanic_id")
      .eq("job_type", "Walk-in")
      .order("started_date", { ascending: false }),
    supabaseAdmin.from("cc_mechanics").select("id, short_code"),
  ]);
  if (jobsErr) throw new Error(jobsErr.message);
  if (mechErr) throw new Error(mechErr.message);

  const mechanicCode = new Map((mechanics ?? []).map((m) => [m.id as string, m.short_code as string]));

  return (jobs ?? [])
    .map((j) => ({ ...j, check: checkCustomerCode(j.customer_code ?? "") }))
    .filter((j) => j.check !== "ok")
    .map((j) => ({
      id: j.id as string,
      branch: j.branch as Branch,
      date: j.started_date || (j.created_at as string)?.slice(0, 10) || "",
      jobsheetNo: j.jobsheet_no?.trim() || j.job_no,
      mechanic: j.mechanic_id ? (mechanicCode.get(j.mechanic_id) ?? "—") : "—",
      reason: customerCodeReason(j.customer_code ?? ""),
      district: "",
      icNumber: j.customer_code ?? "",
      plateNo: j.plate_no ?? "",
      customerName: j.customer_name ?? "",
      model: j.model ?? "",
    }));
}

// The report's own click-to-fix: an admin types in the customer's real IC
// once someone's tracked it down, saved straight onto the jobsheet's
// Customer Code — so the row naturally drops off this report next time
// (checkCustomerCode now passes) instead of needing a separate "resolved"
// flag to keep in sync with the actual data.
export async function amendCustomerCodeAction(id: string, branch: Branch, newCode: string): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const trimmed = newCode.trim();
  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ customer_code: trimmed }).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Amended Customer Code", `job ${id} (${branch}) → ${trimmed || "(cleared)"}`);
  revalidatePath("/reports/customer-ic-check");
  revalidatePath("/repairs/walk-in");
}
