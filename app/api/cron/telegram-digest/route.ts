import { NextRequest, NextResponse } from "next/server";
import { buildAfterSalesDigest, sendToGroups } from "@/lib/telegram-digest";
import { backupExists } from "@/lib/db-backup";
import { todayInMalaysia } from "@/lib/malaysia-time";

export const runtime = "nodejs";
export const maxDuration = 60;

// Same protection as the other cron route: Vercel sends
// "Authorization: Bearer <CRON_SECRET>" on its own scheduled calls.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

// ?dryRun=1 shows the messages without sending them; ?date=YYYY-MM-DD reports a
// specific day instead of yesterday. Each branch's group gets its own branch
// only; the management group gets everything.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? undefined;
  try {
    const messages = await buildAfterSalesDigest(date);
    // Management only: say so if last night's database backup is missing,
    // so a skipped night is noticed the same morning.
    const today = todayInMalaysia();
    const backedUp = await backupExists(today).catch(() => false);
    if (!backedUp && messages.combined) {
      messages.combined += `\n\n⚠️ Last night's database backup (${today}) is missing. Please check.`;
    }
    if (searchParams.get("dryRun") === "1") return NextResponse.json({ dryRun: true, ...messages });
    const result = await sendToGroups(messages);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
