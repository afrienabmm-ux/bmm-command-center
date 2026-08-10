"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { RepairJob, RepairStatus, JobType } from "./types";
import type { Branch } from "./branch";

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
  };
}

// Completed jobs are excluded here so they automatically drop off the
// active list as soon as they're marked Completed — no manual cleanup.
export async function getActiveRepairJobs(branch: Branch): Promise<RepairJob[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("*")
    .eq("branch", branch)
    .neq("status", "Completed")
    .order("started_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toJob);
}

export async function getCompletedRepairJobs(branch: Branch): Promise<RepairJob[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("*")
    .eq("branch", branch)
    .eq("status", "Completed")
    .order("completed_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toJob);
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
}): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, input.branch);
  const { count } = await supabaseAdmin
    .from("cc_repair_jobs")
    .select("*", { count: "exact", head: true })
    .eq("branch", input.branch);
  const jobNo = `RJ-${input.branch.toUpperCase()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const { error } = await supabaseAdmin.from("cc_repair_jobs").insert({
    branch: input.branch,
    job_no: jobNo,
    customer_name: input.customerName,
    plate_no: input.plateNo,
    job_type: input.jobType,
    mechanic_id: input.mechanicId,
    description: input.description,
    revenue_amount: input.revenueAmount,
    deal_type: input.dealType,
    started_date: input.startedDate,
    status: "Pending",
    pic_name: input.picName ?? "",
    model: input.model ?? "",
    bike_year: input.bikeYear ?? "",
    condition: input.condition ?? "",
    location: input.location ?? "",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/repairs");
}

export async function updateRepairStatusAction(id: string, branch: Branch, status: RepairStatus): Promise<void> {
  const user = await requireApproved();
  assertCanEditBranch(user, branch);
  const completedDate = status === "Completed" ? new Date().toISOString().slice(0, 10) : null;
  const { error } = await supabaseAdmin
    .from("cc_repair_jobs")
    .update({ status, completed_date: completedDate })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/repairs");
  revalidatePath("/reports");
  revalidatePath("/");
}
