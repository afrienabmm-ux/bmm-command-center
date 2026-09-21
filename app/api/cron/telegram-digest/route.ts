import { NextRequest, NextResponse } from "next/server";
import { buildAfterSalesDigest, sendTelegram } from "@/lib/telegram-digest";

export const runtime = "nodejs";
export const maxDuration = 60;

// Same protection as the other cron route: Vercel sends
// "Authorization: Bearer <CRON_SECRET>" on its own scheduled calls.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

// ?dryRun=1 shows the message without sending it; ?date=YYYY-MM-DD reports a
// specific day instead of yesterday.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? undefined;
  try {
    const text = await buildAfterSalesDigest(date);
    if (searchParams.get("dryRun") === "1") return NextResponse.json({ dryRun: true, text });
    const sent = await sendTelegram(text);
    return NextResponse.json({ ...sent, text }, { status: sent.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
