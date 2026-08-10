"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved, assertCanEditBranch } from "./current-user";
import type { GenbluRegistration } from "./types";
import type { Branch } from "./branch";

const BUCKET = "genblu-screenshots";

type Row = {
  id: string;
  branch: Branch;
  salesperson_name: string;
  salesperson_code: string;
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
    customerPlateNo: r.customer_plate_no,
    screenshotPath: r.screenshot_path,
    createdAt: r.created_at,
  };
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

export async function getScreenshotUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function addGenbluRegistrationAction(formData: FormData): Promise<{ error: string } | void> {
  const user = await requireApproved();
  const branch = String(formData.get("branch") || "") as Branch;
  assertCanEditBranch(user, branch);

  const salespersonName = String(formData.get("salesperson_name") || "").trim();
  const salespersonCode = String(formData.get("salesperson_code") || "").trim();
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
    customer_plate_no: customerPlateNo,
    screenshot_path: screenshotPath,
  });
  if (error) return { error: error.message };
  revalidatePath("/genblu");
}
