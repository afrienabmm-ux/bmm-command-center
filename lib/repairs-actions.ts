"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, requireManagement, assertCanEditBranch } from "./current-user";
import { logActivity } from "./activity-log";
import { todayInMalaysia } from "./malaysia-time";
import type { RepairJob, RepairJobItem, RepairStatus, JobType, ApprovalStatus, QcResult } from "./types";
import { DEAL_TYPES } from "./types";
import { BRANCHES, type Branch } from "./branch";

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
  jobsheet_photo_path: string | null;
  cc_repair_job_items: ItemRow[] | null;
};

function toJob(r: Row): RepairJob {
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
    jobsheetPhotoPath: r.jobsheet_photo_path,
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
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select(SELECT_WITH_ITEMS)
    .eq("branch", branch)
    .not("status", "in", '("Completed","QC")')
    .order("started_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as Row[]).map(toJob);
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
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select(SELECT_WITH_ITEMS)
    .eq("branch", branch)
    .eq("status", "Completed")
    .order("completed_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as unknown as Row[]).map(toJob);
}

// Completed jobs across all 3 branches — for the "All Branches" view.
export async function getAllBranchesCompletedRepairJobs(): Promise<RepairJob[]> {
  await requireApproved();
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getCompletedRepairJobs(value)));
  return perBranch.flat().sort((a, b) => (b.completedDate ?? "").localeCompare(a.completedDate ?? ""));
}

// Restore Bike jobs waiting on the branch PIC's QC pass/fail — the
// mechanic's repair is done (completed_date is when that happened, and
// doubles as when the QC clock starts).
export async function getQcRepairJobs(branch: Branch): Promise<RepairJob[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select(SELECT_WITH_ITEMS)
    .eq("branch", branch)
    .eq("status", "QC")
    .order("completed_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as Row[]).map(toJob);
}

// QC jobs across all 3 branches — for the "All Branches" view.
export async function getAllBranchesQcRepairJobs(): Promise<RepairJob[]> {
  await requireApproved();
  const perBranch = await Promise.all(BRANCHES.map((b) => getQcRepairJobs(b.value)));
  return perBranch.flat();
}

// Looked up by id alone (no branch filter) — used by the full-page edit
// route, which only has the job id from the URL.
export async function getRepairJobById(id: string): Promise<RepairJob | null> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select(SELECT_WITH_ITEMS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toJob(data as unknown as Row) : null;
}

// Active Restore Bike jobs that have been running more than 5 days since
// they started — surfaced as an in-app alert, no external notification.
export async function getOverdueRestoreBikeJobs(branch: Branch): Promise<RepairJob[]> {
  const active = await getActiveRepairJobs(branch);
  const today = new Date();
  return active.filter((j) => {
    if (j.jobType !== "Restore Bike" || !j.startedDate) return false;
    const started = new Date(j.startedDate);
    const days = Math.floor((today.getTime() - started.getTime()) / 86400000);
    return days > 5;
  });
}

export type OverdueRestoreBikeJob = RepairJob & { daysRunning: number };

// Same overdue check, merged across all 3 branches by default (or just
// onlyBranch, for the single-branch dashboard view).
export async function getAllBranchesOverdueRestoreBikeJobs(onlyBranch?: Branch): Promise<OverdueRestoreBikeJob[]> {
  const branches = onlyBranch ? [onlyBranch] : BRANCHES.map((b) => b.value);
  const perBranch = await Promise.all(branches.map((value) => getOverdueRestoreBikeJobs(value)));
  const today = new Date();
  return perBranch
    .flat()
    .map((j) => ({
      ...j,
      daysRunning: j.startedDate ? Math.floor((today.getTime() - new Date(j.startedDate).getTime()) / 86400000) : 0,
    }))
    .sort((a, b) => b.daysRunning - a.daysRunning);
}

// Restore Bike jobs sitting at Pending approval — the GM's own to-do
// list. Any active job counts, whether or not a mechanic's been assigned
// yet, since approval is what unblocks the Start button either way.
export async function getAllBranchesPendingApprovalJobs(onlyBranch?: Branch): Promise<RepairJob[]> {
  await requireApproved();
  const active = onlyBranch ? await getActiveRepairJobs(onlyBranch) : await getAllBranchesActiveRepairJobs();
  return active.filter((j) => j.jobType === "Restore Bike" && j.approvalStatus === "Pending");
}

// The flip side of the list above — jobs the GM just approved but the
// branch PIC hasn't started yet. Surfaced as a dashboard notice so the PIC
// finds out without having to keep checking the Restore Bike list.
export async function getAllBranchesApprovedReadyToStartJobs(onlyBranch?: Branch): Promise<RepairJob[]> {
  await requireApproved();
  const active = onlyBranch ? await getActiveRepairJobs(onlyBranch) : await getAllBranchesActiveRepairJobs();
  return active.filter((j) => j.jobType === "Restore Bike" && j.approvalStatus === "Approved" && !j.startedDate);
}

// QC jobs that have been waiting more than 3 days since the repair
// finished — the PIC's own overdue alert, same shape as the mechanics'
// 5-day one above.
export async function getOverdueQcJobs(branch: Branch): Promise<RepairJob[]> {
  const qc = await getQcRepairJobs(branch);
  const today = new Date();
  return qc.filter((j) => {
    if (!j.completedDate) return false;
    const finished = new Date(j.completedDate);
    const days = Math.floor((today.getTime() - finished.getTime()) / 86400000);
    return days > 3;
  });
}

export type OverdueQcJob = RepairJob & { daysWaiting: number };

// Same overdue check, merged across all 3 branches by default (or just
// onlyBranch, for the single-branch dashboard view).
export async function getAllBranchesOverdueQcJobs(onlyBranch?: Branch): Promise<OverdueQcJob[]> {
  const branches = onlyBranch ? [onlyBranch] : BRANCHES.map((b) => b.value);
  const perBranch = await Promise.all(branches.map((value) => getOverdueQcJobs(value)));
  const today = new Date();
  return perBranch
    .flat()
    .map((j) => ({
      ...j,
      daysWaiting: j.completedDate ? Math.floor((today.getTime() - new Date(j.completedDate).getTime()) / 86400000) : 0,
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
}

export type QcReminderJob = RepairJob & { daysWaiting: number; dueDate: string };

// QC jobs still inside their 72-hour (3-day) window — the "reminder"
// counterpart to getAllBranchesOverdueQcJobs above. Shown as soon as a job
// lands in QC (End Date clicked) and stops once it's either passed/failed
// or crosses into the overdue list, so the PIC sees one banner or the
// other, never both for the same job.
export async function getAllBranchesQcReminderJobs(onlyBranch?: Branch): Promise<QcReminderJob[]> {
  const branches = onlyBranch ? [onlyBranch] : BRANCHES.map((b) => b.value);
  const perBranch = await Promise.all(branches.map((value) => getQcRepairJobs(value)));
  const today = new Date();
  return perBranch
    .flat()
    .filter((j) => j.completedDate)
    .map((j) => {
      const finished = new Date(j.completedDate as string);
      const daysWaiting = Math.floor((today.getTime() - finished.getTime()) / 86400000);
      const due = new Date(finished);
      due.setDate(due.getDate() + 3);
      return { ...j, daysWaiting, dueDate: due.toISOString().slice(0, 10) };
    })
    .filter((j) => j.daysWaiting <= 3)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 7);

  return (data ?? [])
    .map((r) => {
      const due = new Date(r.next_service_date as string);
      const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
      return {
        id: r.id as string,
        branch: r.branch as Branch,
        customerName: r.customer_name as string,
        customerPhone: r.customer_phone as string,
        plateNo: r.plate_no as string,
        model: r.model as string,
        nextServiceDate: r.next_service_date as string,
        daysUntil,
      };
    })
    .filter((j) => !Number.isNaN(j.daysUntil) && new Date(j.nextServiceDate) <= cutoff)
    .sort((a, b) => a.daysUntil - b.daysUntil);
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
  const codes = new Set([...oldCounts.keys(), ...newCounts.keys()]);

  for (const code of codes) {
    const delta = (newCounts.get(code) ?? 0) - (oldCounts.get(code) ?? 0);
    if (delta <= 0) continue;

    const { data: product } = await supabaseAdmin.from("cc_catalog_products").select("id").eq("code", code).maybeSingle();
    if (!product) continue;

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
  }
}

// "Bike Arrived" quick-add: creates a bare Restore Bike job stamped with
// today's arrival date, skipping the usual mechanic-assignment check since
// there's no mechanic yet — the PIC fills in the rest (plate, mechanic,
// etc.) on the edit form that opens right after.
export async function quickAddRestoreBikeArrivalAction(branch: Branch): Promise<{ id: string }> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  const { count } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("*", { count: "exact", head: true })
    .eq("branch", branch);
  const jobNo = `RJ-${JOB_NO_BRANCH_CODE[branch]}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .insert({
      branch,
      job_no: jobNo,
      customer_name: "",
      plate_no: "",
      job_type: "Restore Bike",
      mechanic_id: null,
      description: "",
      revenue_amount: 0,
      deal_type: DEAL_TYPES[0],
      status: "Pending",
      arrived_date: todayInMalaysia(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logActivity(user, "Added Restore Bike arrival", `${jobNo} (${branch})`);
  revalidatePath("/repairs");
  return { id: data.id };
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
  const assignmentCheck = await assertMechanicAssignment(
    input.mechanicId,
    input.isBigItem ?? false,
    undefined,
    input.jobType !== "Restore Bike"
  );
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
  const assignmentCheck = await assertMechanicAssignment(
    input.mechanicId,
    input.isBigItem ?? false,
    id,
    input.jobType !== "Restore Bike"
  );
  if (assignmentCheck && "error" in assignmentCheck) return assignmentCheck;
  const revenueAmount = items.length > 0 ? itemsTotal(items) : input.revenueAmount;

  const { data: existingItems } = await supabaseAdmin
    .from("cc_repair_job_items")
    .select("code, description, quantity, price")
    .eq("job_id", id);

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
  await logActivity(user, `Updated ${input.jobType} job`, `${input.customerName || input.plateNo} (${branch})`);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
  revalidatePath("/catalog");
  revalidatePath("/");
}

// GM approval only — a branch PIC can see the status but not set it
// themselves, since "the repair start is gated on GM approval" only means
// something if the PIC can't just approve their own job. Not branch-locked
// like most other actions here — a Management approval isn't scoped to
// one branch.
export async function updateRepairApprovalAction(id: string, approvalStatus: ApprovalStatus): Promise<void> {
  const approver = await requireManagement();
  const { data: job } = await supabaseAdmin.from("cc_repair_jobs").select("job_no").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ approval_status: approvalStatus }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(approver, "Set Restore Bike approval", `${job?.job_no ?? id} → ${approvalStatus}`);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
  revalidatePath("/");
}

export type RestoreBikeWorkflowStage = "quotation" | "stockOrder" | "stockArrive" | "started" | "completed";

const WORKFLOW_STAGE_COLUMNS: Record<
  RestoreBikeWorkflowStage,
  "quotation_date" | "stock_order_date" | "stock_arrive_date" | "started_date" | "completed_date"
> = {
  quotation: "quotation_date",
  stockOrder: "stock_order_date",
  stockArrive: "stock_arrive_date",
  started: "started_date",
  completed: "completed_date",
};

// Click-to-stamp workflow milestones on the Restore Bike list — no need to
// open the full edit form. Clicking sets today's date; clicking an
// already-stamped one clears it back to unset. "Started" is gated on the
// job's existing Approval status (Approved) rather than a separate GM
// stamp. "Completed" (really "repair finished") doesn't hard-block, but
// refuses to set a date if the job hasn't started yet — the caller shows
// that as a warning. It also doesn't mark the job Completed directly
// anymore — it moves to QC, and setQcResultAction below is what finally
// completes it (or sends it back) once the branch PIC signs off.
// Returns { error } instead of throwing — a thrown Error from a Server
// Action gets mangled into an unhelpful "Minified React error #441" on the
// client in production builds, instead of surfacing the message. Returning
// a plain value sidesteps that entirely (same pattern as the GenBlu
// actions below).
export async function setRestoreBikeWorkflowDateAction(
  id: string,
  branch: Branch,
  stage: RestoreBikeWorkflowStage,
  value: string | null
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  let existing: {
    approval_status?: ApprovalStatus;
    started_date?: string | null;
    stock_order_date?: string | null;
    stock_arrive_date?: string | null;
    qc_fail_reason?: string | null;
    qc_fail_followup_date?: string | null;
  } | null = null;
  if (stage === "started" || stage === "completed") {
    const { data, error: fetchError } = await supabaseAdmin
      .from("cc_repair_jobs")
      .select("approval_status, started_date, stock_order_date, stock_arrive_date, qc_fail_reason, qc_fail_followup_date")
      .eq("id", id)
      .single();
    if (fetchError) return { error: fetchError.message };
    existing = data;
    if (value !== null && stage === "started" && existing?.approval_status !== "Approved") {
      return { error: "This job needs GM approval before the repair can start." };
    }
    if (value !== null && stage === "started" && (!existing?.stock_order_date || !existing?.stock_arrive_date)) {
      return { error: "Set the Stock Order date and Stock Arrival date before starting the repair." };
    }
    if (value !== null && stage === "completed" && !existing?.started_date) {
      return { error: "The job hasn't started yet." };
    }
    if (value !== null && stage === "completed" && existing?.qc_fail_reason && !existing?.qc_fail_followup_date) {
      return { error: "Follow up on the QC failure reason before sending this back for QC again." };
    }
  }

  const column = WORKFLOW_STAGE_COLUMNS[stage];
  const update: Record<string, string | null> = { [column]: value };
  // Status is no longer a manual choice — it just follows the Start/End
  // stamps: Start sets In Progress, End sets Completed, clearing either
  // steps back down. This keeps Status from drifting out of sync with the
  // stamps a PIC actually clicks.
  if (stage === "started") {
    update.status = value ? "In Progress" : "Pending";
  }
  if (stage === "completed") {
    update.status = value ? "QC" : existing?.started_date ? "In Progress" : "Pending";
  }

  const { error } = await supabaseAdmin.from("cc_repair_jobs").update(update).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, `Set Restore Bike ${stage}`, `${id} → ${value ?? "cleared"}`);
  revalidatePath("/repairs");
  revalidatePath("/");
}

// The Assign button on the Restore Bike list — picks a mechanic for a job
// that was added via Main Listing without one. Same busy/heavy-repair
// rules as everywhere else a mechanic gets set (assertMechanicAssignment),
// just as its own lightweight action instead of going through the full
// edit form.
export async function assignMechanicAction(id: string, branch: Branch, mechanicId: string): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  const { data: job, error: fetchError } = await supabaseAdmin.from("cc_repair_jobs").select("is_big_item").eq("id", id).single();
  if (fetchError) return { error: fetchError.message };

  const assignmentCheck = await assertMechanicAssignment(mechanicId, job.is_big_item, id);
  if (assignmentCheck && "error" in assignmentCheck) return assignmentCheck;

  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ mechanic_id: mechanicId }).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Assigned mechanic", `job ${id} (${branch})`);
  revalidatePath("/repairs");
  revalidatePath("/");
}

// The branch PIC's QC call on a Restore Bike job sitting in the QC tab.
// Passing moves it to Completed for good; failing sends it back to the
// mechanic to redo (clears the End Date so it reappears in Active) but
// keeps the "Failed" result and the PIC's reason visible on the job,
// instead of silently wiping them — a reason is required for Fail so
// there's always a record of why. Also clears any old follow-up stamp —
// each failure needs its own follow-up, not a leftover one from last time.
export async function setQcResultAction(
  id: string,
  branch: Branch,
  result: QcResult,
  failReason?: string
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  if (result === "Failed" && !failReason?.trim()) {
    return { error: "A reason is required when failing QC." };
  }

  const today = todayInMalaysia();
  const update =
    result === "Passed"
      ? { status: "Completed", qc_result: "Passed", qc_date: today, qc_fail_reason: null, qc_fail_followup_date: null }
      : {
          status: "In Progress",
          completed_date: null,
          qc_result: "Failed",
          qc_date: today,
          qc_fail_reason: failReason!.trim(),
          qc_fail_followup_date: null,
        };

  const { error } = await supabaseAdmin.from("cc_repair_jobs").update(update).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Set QC result", `job ${id} → ${result}${failReason ? `: ${failReason.trim()}` : ""}`);
  revalidatePath("/repairs");
  revalidatePath("/");
}

// Click-to-stamp confirmation that the PIC actually looked into why the
// bike failed QC — required before the repair can be re-submitted to QC
// (see the "completed" stage check in setRestoreBikeWorkflowDateAction),
// so a failure reason can't just sit there unaddressed. Same toggle
// behaviour as the other workflow stamps: clicking again un-stamps it.
export async function setQcFailFollowupAction(id: string, branch: Branch, value: string | null): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ qc_fail_followup_date: value }).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(user, "Set QC fail follow-up", `job ${id} → ${value ?? "cleared"}`);
  revalidatePath("/repairs");
  revalidatePath("/");
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

const RESTORE_BIKE_PHOTO_BUCKET = "restore-bike-photos";

const MAX_RESTORE_BIKE_PHOTOS = 5;

// Restore Bike only — up to 5 photos of the bike, stored the same way as
// GenBlu screenshots (private bucket, paths only in the DB; resolved to
// time-limited signed URLs whenever they need to be shown). Uploads add to
// whatever's already on the job rather than replacing it, capped at 5
// total.
export async function uploadRestoreBikeImagesAction(
  jobId: string,
  branch: Branch,
  formData: FormData
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "No photos were uploaded." };

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("image_paths")
    .eq("id", jobId)
    .single();
  if (fetchError) return { error: fetchError.message };

  const existingPaths: string[] = existing.image_paths ?? [];
  const room = MAX_RESTORE_BIKE_PHOTOS - existingPaths.length;
  if (room <= 0) return { error: `Already has ${MAX_RESTORE_BIKE_PHOTOS} photos — remove one before adding more.` };

  const toUpload = files.slice(0, room);
  const newPaths: string[] = [];
  for (const file of toUpload) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${branch}/${jobId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(RESTORE_BIKE_PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (uploadError) return { error: `Couldn't upload the photo: ${uploadError.message}` };
    newPaths.push(path);
  }

  const { error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .update({ image_paths: [...existingPaths, ...newPaths] })
    .eq("id", jobId);
  if (error) return { error: error.message };
  await logActivity(user, "Uploaded Restore Bike photos", `job ${jobId} (${newPaths.length} photo${newPaths.length === 1 ? "" : "s"})`);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
}

export async function removeRestoreBikeImageAction(jobId: string, branch: Branch, path: string): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("image_paths")
    .eq("id", jobId)
    .single();
  if (fetchError) return { error: fetchError.message };

  const nextPaths = ((existing.image_paths as string[]) ?? []).filter((p) => p !== path);
  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ image_paths: nextPaths }).eq("id", jobId);
  if (error) return { error: error.message };
  await logActivity(user, "Removed Restore Bike photo", `job ${jobId}`);
  await supabaseAdmin.storage.from(RESTORE_BIKE_PHOTO_BUCKET).remove([path]);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
}

export async function getRestoreBikeImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(RESTORE_BIKE_PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function getRestoreBikeImageUrls(paths: string[]): Promise<string[]> {
  const urls = await Promise.all(paths.map((p) => getRestoreBikeImageUrl(p)));
  return urls.filter((u): u is string => u !== null);
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
