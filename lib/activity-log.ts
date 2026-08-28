import "server-only";
import { supabaseAdmin } from "./supabase-server";

// Deliberately hardcoded to these two specific people, not a role check —
// Administrator (or any other role) doesn't grant access to this page.
export const LOGS_VIEWER_EMAILS = ["jasonng1494@gmail.com", "afrienabmm@gmail.com"];

export function canViewLogs(email: string | null | undefined): boolean {
  return !!email && LOGS_VIEWER_EMAILS.includes(email);
}

export type ActivityLog = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
};

// Never lets a logging failure block the real action it's attached to —
// worst case a login or team change goes unrecorded, not broken.
export async function logActivity(
  user: { id: string; name: string; email: string },
  action: string,
  detail?: string
): Promise<void> {
  try {
    await supabaseAdmin.from("cc_activity_logs").insert({
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      action,
      detail: detail ?? null,
    });
  } catch {
    // See above.
  }
}

type LogRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  detail: string | null;
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
    createdAt: r.created_at,
  }));
}
