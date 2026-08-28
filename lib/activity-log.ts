"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";

export type ActivityLog = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
};

async function currentIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

// Every action that saves something also calls this and awaits it — so the
// actual database write happens via after(), scheduled to run once the
// response has already gone back to the browser. Awaiting logActivity()
// itself still only costs reading the request's IP (fast, no network
// round-trip), not the insert — the save the user is waiting on was never
// blocked by writing this log.
export async function logActivity(
  user: { id: string; name: string; email: string },
  action: string,
  detail?: string
): Promise<void> {
  const ip = await currentIp();
  after(async () => {
    try {
      await supabaseAdmin.from("cc_activity_logs").insert({
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        action,
        detail: detail ?? null,
        ip_address: ip,
      });
    } catch {
      // Never lets a logging failure surface anywhere — worst case
      // something goes unrecorded, not broken.
    }
  });
}

// The one client-callable entry point — for actions that happen entirely in
// the browser with nothing else to call the server for, like a CSV export.
export async function logClientActivityAction(action: string, detail?: string): Promise<void> {
  const user = await requireApproved();
  await logActivity(user, action, detail);
}

type LogRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
};

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabaseAdmin
    .from("cc_activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data as LogRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    userEmail: r.user_email,
    action: r.action,
    detail: r.detail,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  }));
}
