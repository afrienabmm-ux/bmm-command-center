// Receives the Sales Dashboard's own pre-computed monthly GenBlu report
// (bikes sold vs. GenBlu installed / e-coupon usage, by branch and
// salesperson) — a different feed from app/api/genblu-intake (which sends
// individual customer registrations), but authenticated with the exact
// same shared secret, per the Sales Dashboard team's own spec.
//
// The payload's shape (targets/total/branches/salespeople, each carrying
// bikes_sold/genblu_installed/install_pct/ecoupon_used/ecoupon_pct) is
// entirely theirs to define — stored as-is in cc_genblu_reports.report
// rather than normalized into columns, so a field they add later doesn't
// need a migration here to show up. Only a month is ever kept per report:
// a fresh delivery for the same X-Report-Month replaces the last one.
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const SECRET = process.env.GENBLU_INTAKE_SECRET;

function signatureValid(rawBody: string, provided: string): boolean {
  if (!SECRET) return false;
  const expected = createHmac("sha256", SECRET).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(req: Request): Promise<Response> {
  if (!SECRET) {
    return Response.json({ error: "intake not configured" }, { status: 503 });
  }

  // Read the RAW body and verify the signature against it BEFORE parsing —
  // re-serializing parsed JSON changes the bytes and the HMAC breaks.
  const raw = await req.text();

  if (req.headers.get("authorization") !== `Bearer ${SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!signatureValid(raw, req.headers.get("x-signature") ?? "")) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }

  const reportMonth = req.headers.get("x-report-month");
  if (!reportMonth || !/^\d{4}-\d{2}$/.test(reportMonth)) {
    return Response.json({ error: "missing or invalid X-Report-Month header (expected YYYY-MM)" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (body.month !== reportMonth) {
    return Response.json({ error: `X-Report-Month (${reportMonth}) doesn't match body.month (${body.month})` }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("cc_genblu_reports")
    .upsert({ month: reportMonth, report: body, received_at: new Date().toISOString() }, { onConflict: "month" });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}

// Reject other verbs explicitly so a mistake is obvious rather than silent.
export async function GET(): Promise<Response> {
  return Response.json({ error: "POST only" }, { status: 405 });
}
