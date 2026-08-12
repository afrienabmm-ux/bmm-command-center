"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { RepairJob, RepairJobItem, RepairStatus, JobType, ApprovalStatus } from "./types";
import { BRANCHES, type Branch } from "./branch";

type ItemRow = { id: string; description: string; quantity: number; price: number };

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
  started_date: string;
  completed_date: string | null;
  created_at: string;
  pic_name: string;
  model: string;
  bike_year: string;
  condition: string;
  location: string;
  stock_order_date: string | null;
  stock_arrive_date: string | null;
  prepared_by: string;
  approval_status: ApprovalStatus;
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
    picName: r.pic_name,
    model: r.model,
    bikeYear: r.bike_year,
    condition: r.condition,
    location: r.location,
    items: (r.cc_repair_job_items ?? []).map((i): RepairJobItem => ({
      id: i.id,
      description: i.description,
      quantity: Number(i.quantity),
      price: Number(i.price),
    })),
    stockOrderDate: r.stock_order_date,
    stockArriveDate: r.stock_arrive_date,
    preparedBy: r.prepared_by,
    approvalStatus: r.approval_status,
  };
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

// Active Restore Bike jobs that have been running more than 5 days since
// they started — surfaced as an in-app alert, no external notification.
export async function getOverdueRestoreBikeJobs(branch: Branch): Promise<RepairJob[]> {
  const active = await getActiveRepairJobs(branch);
  const today = new Date();
  return active.filter((j) => {
    if (j.jobType !== "Restore Bike") return false;
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
      daysRunning: Math.floor((today.getTime() - new Date(j.startedDate).getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysRunning - a.daysRunning);
}

type ItemInput = { description: string; quantity: number; price: number };

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
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      sort_order: i,
    }))
  );
  if (insError) throw new Error(insError.message);
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
  startedDate: string;
  picName?: string;
  model?: string;
  bikeYear?: string;
  condition?: string;
  location?: string;
  items?: ItemInput[];
  stockOrderDate?: string | null;
  stockArriveDate?: string | null;
  completedDate?: string | null;
  preparedBy?: string;
}): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const { count } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("*", { count: "exact", head: true })
    .eq("branch", input.branch);
  const jobNo = `RJ-${input.branch.toUpperCase()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const items = input.items ?? [];
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
      started_date: input.startedDate,
      status: "Pending",
      pic_name: input.picName ?? "",
      model: input.model ?? "",
      bike_year: input.bikeYear ?? "",
      condition: input.condition ?? "",
      location: input.location ?? "",
      stock_order_date: input.stockOrderDate ?? null,
      stock_arrive_date: input.stockArriveDate ?? null,
      completed_date: input.completedDate ?? null,
      prepared_by: input.preparedBy ?? "",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items.length > 0) await replaceJobItems(data.id, items);
  revalidatePath("/repairs");
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
    startedDate: string;
    picName?: string;
    model?: string;
    bikeYear?: string;
    condition?: string;
    location?: string;
    items?: ItemInput[];
    stockOrderDate?: string | null;
    stockArriveDate?: string | null;
    completedDate?: string | null;
    preparedBy?: string;
  }
): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const items = input.items ?? [];
  const revenueAmount = items.length > 0 ? itemsTotal(items) : input.revenueAmount;

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
      pic_name: input.picName ?? "",
      model: input.model ?? "",
      bike_year: input.bikeYear ?? "",
      condition: input.condition ?? "",
      location: input.location ?? "",
      stock_order_date: input.stockOrderDate ?? null,
      stock_arrive_date: input.stockArriveDate ?? null,
      completed_date: input.completedDate ?? null,
      prepared_by: input.preparedBy ?? "",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await replaceJobItems(id, items);
  revalidatePath("/repairs");
  revalidatePath("/reports");
  revalidatePath("/");
}

export async function updateRepairApprovalAction(id: string, branch: Branch, approvalStatus: ApprovalStatus): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const { error } = await supabaseAdmin.from("cc_repair_jobs").update({ approval_status: approvalStatus }).eq("id", id);
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
  revalidatePath("/reports");
  revalidatePath("/");
}
