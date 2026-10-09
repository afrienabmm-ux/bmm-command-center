import { NextRequest, NextResponse } from "next/server";
import { runDatabaseBackup } from "@/lib/db-backup";
import { sendTelegram } from "@/lib/telegram-digest";
import { todayInMalaysia } from "@/lib/malaysia-time";

export const runtime = "nodejs";
export const maxDuration = 120;

// Same protection as the other cron routes: Vercel sends
// "Authorization: Bearer <CRON_SECRET>" on its own scheduled calls.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

// Runs nightly (see vercel.json). A failure is posted to the management
// Telegram group, so a backup that silently stopped working gets noticed.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dateKey = todayInMalaysia();
  try {
    const result = await runDatabaseBackup(dateKey);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegram(`⚠️ After-Sales nightly backup FAILED (${dateKey}): ${message}`).catch(() => null);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
