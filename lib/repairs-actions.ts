"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { RepairJob, RepairJobItem, RepairStatus, JobType, ApprovalStatus } from "./types";
import { HEAVY_ITEM_COUNT_THRESHOLD, DEAL_TYPES } from "./types";
import { BRANCHES, type Branch } from "./branch";

type ItemRow = { id: string; code: string; description: string; quantity: number; price: number };

type Row = {
  id: string;
  branch: Branch;
  job_no: string;
  customer_name: string;
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
  image_path: string | null;
  arrived_date: string | null;
  quotation_date: string | null;
  cc_repair_job_items: ItemRow[] | null;
};

function toJob(r: Row): RepairJob {
  return {
    id: r.id,
    branch: r.branch,
    jobNo: r.job_no,
    customerName: r.customer_name,
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
    imagePath: r.image_path,
    arrivedDate: r.arrived_date,
    quotationDate: r.quotation_date,
  };
}

// Every job needs a mechanic assigned, a mechanic can only carry one active
// (non-Completed) job at a time, and heavy jobs (more than 3 items, or
// manually flagged as a big item) can only go to mechanics in the "Heavy
// Repair" category. Enforced server-side so it can't be bypassed even if
// the UI's own filtering is stale.
async function assertMechanicAssignment(
  mechanicId: string | null,
  items: ItemInput[],
  isBigItem: boolean,
  excludeJobId?: string
): Promise<void> {
  if (!mechanicId) throw new Error("A mechanic must be assigned to this job.");

  const { data: mechanic, error: mechError } = await supabaseAdmin
    .from("cc_mechanics")
    .select("category")
    .eq("id", mechanicId)
    .single();
  if (mechError) throw new Error(mechError.message);

  const isHeavy = items.length > HEAVY_ITEM_COUNT_THRESHOLD || isBigItem;
  if (isHeavy && mechanic.category !== "Heavy Repair") {
    throw new Error("This is a heavy repair job — it can only be assigned to a Heavy Repair mechanic.");
  }

  let busyQuery = supabaseAdmin
    .from("cc_repair_jobs")
    .select("id", { count: "exact", head: true })
    .eq("mechanic_id", mechanicId)
    .neq("status", "Completed");
  if (excludeJobId) busyQuery = busyQuery.neq("id", excludeJobId);
  const { count, error: busyError } = await busyQuery;
  if (busyError) throw new Error(busyError.message);
  if ((count ?? 0) > 0) {
    throw new Error("This mechanic already has an active job assigned — they're free again once it's marked Completed.");
  }
}

const SELECT_WITH_ITEMS = "*, cc_repair_job_items(*)";

// Completed jobs are excluded here so they automatically drop off the
// active list as soon as they're marked Completed — no manual cleanup.
// Memoized per request: the dashboard asks for the same branch's active
// jobs twice (branch breakdown, then the overdue check).
const cachedActiveRepairJobs = cache(async (branch: Branch): Promise<RepairJob[]> => {
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select(SELECT_WITH_ITEMS)
    .eq("branch", branch)
    .neq("status", "Completed")
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

// Same overdue check, merged across all 3 branches for the Dashboard alert.
export async function getAllBranchesOverdueRestoreBikeJobs(): Promise<OverdueRestoreBikeJob[]> {
  const perBranch = await Promise.all(BRANCHES.map(({ value }) => getOverdueRestoreBikeJobs(value)));
  const today = new Date();
  return perBranch
    .flat()
    .map((j) => ({
      ...j,
      daysRunning: j.startedDate ? Math.floor((today.getTime() - new Date(j.startedDate).getTime()) / 86400000) : 0,
    }))
    .sort((a, b) => b.daysRunning - a.daysRunning);
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
  const jobNo = `RJ-${branch.toUpperCase()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

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
      arrived_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/repairs");
  return { id: data.id };
}

export async function addRepairJobAction(input: {
  branch: Branch;
  customerName: string;
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
}): Promise<{ id: string }> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const items = input.items ?? [];
  await assertMechanicAssignment(input.mechanicId, items, input.isBigItem ?? false);

  const { count } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("*", { count: "exact", head: true })
    .eq("branch", input.branch);
  const jobNo = `RJ-${input.branch.toUpperCase()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const revenueAmount = items.length > 0 ? itemsTotal(items) : input.revenueAmount;

  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .insert({
      branch: input.branch,
      job_no: jobNo,
      customer_name: input.customerName,
      plate_no: input.plateNo,
      job_type: input.jobType,
      mechanic_id: input.mechanicId,
      description: input.description,
      revenue_amount: revenueAmount,
      deal_type: input.dealType,
      started_date: input.startedDate ?? null,
      form_date: input.formDate ?? null,
      status: "Pending",
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
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items.length > 0) {
    await replaceJobItems(data.id, items);
    await deductCatalogStockForNewItems(input.branch, [], items);
  }
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
  revalidatePath("/catalog");
  return { id: data.id };
}

export async function updateRepairJobAction(
  id: string,
  branch: Branch,
  input: {
    customerName: string;
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
  }
): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const items = input.items ?? [];
  await assertMechanicAssignment(input.mechanicId, items, input.isBigItem ?? false, id);
  const revenueAmount = items.length > 0 ? itemsTotal(items) : input.revenueAmount;

  const { data: existingItems } = await supabaseAdmin
    .from("cc_repair_job_items")
    .select("code, description, quantity, price")
    .eq("job_id", id);

  const { error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .update({
      customer_name: input.customerName,
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
      stock_order_date: input.stockOrderDate ?? null,
      stock_arrive_date: input.stockArriveDate ?? null,
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
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await replaceJobItems(id, items);
  await deductCatalogStockForNewItems(branch, (existingItems as ItemInput[] | null) ?? [], items);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
  revalidatePath("/catalog");
  revalidatePath("/");
}

export async function updateRepairApprovalAction(id: string, branch: Branch, approvalStatus: ApprovalStatus): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ approval_status: approvalStatus }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
}

export type RestoreBikeWorkflowStage = "quotation" | "started" | "completed";

const WORKFLOW_STAGE_COLUMNS: Record<RestoreBikeWorkflowStage, "quotation_date" | "started_date" | "completed_date"> = {
  quotation: "quotation_date",
  started: "started_date",
  completed: "completed_date",
};

// Click-to-stamp workflow milestones on the Restore Bike list — no need to
// open the full edit form. Clicking sets today's date; clicking an
// already-stamped one clears it back to unset. "Started" is gated on the
// job's existing Approval status (Approved) rather than a separate GM
// stamp. "Completed" doesn't hard-block, but refuses to set a date if the
// job hasn't started yet — the caller shows that as a warning.
export async function setRestoreBikeWorkflowDateAction(
  id: string,
  branch: Branch,
  stage: RestoreBikeWorkflowStage,
  value: string | null
): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  if (value !== null && (stage === "started" || stage === "completed")) {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("cc_repair_jobs")
      .select("approval_status, started_date")
      .eq("id", id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (stage === "started" && existing?.approval_status !== "Approved") {
      throw new Error("This job needs GM approval before the repair can start.");
    }
    if (stage === "completed" && !existing?.started_date) {
      throw new Error("The job hasn't started yet.");
    }
  }

  const column = WORKFLOW_STAGE_COLUMNS[stage];
  const { error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .update({ [column]: value })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/repairs");
}

export async function updateRepairStatusAction(id: string, branch: Branch, status: RepairStatus): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  // The end date can also be set by hand on the job form, so only fill it
  // in automatically when marking a job Completed that doesn't have one
  // yet — never overwrite or clear a date someone chose deliberately.
  const update: { status: RepairStatus; completed_date?: string } = { status };
  if (status === "Completed") {
    const { data: existing } = await supabaseAdmin
      .from("cc_repair_jobs")
      .select("completed_date")
      .eq("id", id)
      .single();
    if (!existing?.completed_date) {
      update.completed_date = new Date().toISOString().slice(0, 10);
    }
  }

  const { error } = await supabaseAdmin.from("cc_repair_jobs").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
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
  revalidatePath("/repairs/walk-in");
  revalidatePath("/");
}

export async function deleteRepairJobAction(id: string, branch: Branch): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_repair_jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
  revalidatePath("/");
}

const RESTORE_BIKE_PHOTO_BUCKET = "restore-bike-photos";

// Restore Bike only — the required photo of the bike, stored the same way
// as GenBlu screenshots (private bucket, path only in the DB; resolved to
// a time-limited signed URL whenever it needs to be shown).
export async function uploadRestoreBikeImageAction(
  jobId: string,
  branch: Branch,
  formData: FormData
): Promise<{ error: string } | void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { error: "No photo was uploaded." };

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${branch}/${jobId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(RESTORE_BIKE_PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) return { error: `Couldn't upload the photo: ${uploadError.message}` };

  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ image_path: path }).eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath("/repairs");
  revalidatePath("/repairs/walk-in");
}

export async function getRestoreBikeImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(RESTORE_BIKE_PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
