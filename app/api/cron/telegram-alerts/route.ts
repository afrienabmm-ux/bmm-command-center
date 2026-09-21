import { NextRequest, NextResponse } from "next/server";
import { buildAfterSalesAlerts } from "@/lib/telegram-alerts";
import { sendTelegram } from "@/lib/telegram-digest";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

// ?dryRun=1 shows the message without sending; ?date=YYYY-MM-DD pretends it is
// that day. Sends nothing when there is nothing to report.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  try {
    const { sections, text } = await buildAfterSalesAlerts(searchParams.get("date") ?? undefined);
    if (searchParams.get("dryRun") === "1") return NextResponse.json({ dryRun: true, sections, text });
    if (!text) return NextResponse.json({ sent: false, sections: 0 });
    const sent = await sendTelegram(text);
    return NextResponse.json({ ...sent, sections }, { status: sent.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
