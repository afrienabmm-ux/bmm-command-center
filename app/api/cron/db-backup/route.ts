import { NextRequest, NextResponse } from "next/server";
import { runDatabaseBackup, backupExists } from "@/lib/db-backup";
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
  // The 4am run is a second try: it only does anything if the 2am backup
  // didn't happen (4 and 11 Nov 2026 were skipped without any error).
  const ifMissing = new URL(req.url).searchParams.get("ifMissing") === "1";
  try {
    if (ifMissing && (await backupExists(dateKey))) {
      return NextResponse.json({ ok: true, skipped: `${dateKey} backup already there` });
    }
    const result = await runDatabaseBackup(dateKey);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegram(`⚠️ After-Sales nightly backup FAILED (${dateKey}): ${message}`).catch(() => null);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
