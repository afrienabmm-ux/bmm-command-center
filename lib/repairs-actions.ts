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
  started_date: string;
  completed_date: string | null;
  created_at: string;
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
    startedDate: r.started_date,
    completedDate: r.completed_date,
    createdAt: r.created_at,
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
  startedDate: string;
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
    started_date: input.startedDate,
    status: "Pending",
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
