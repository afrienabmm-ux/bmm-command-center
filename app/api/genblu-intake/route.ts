// Receives GenBlu registrations forwarded from the separate Sales
// Dashboard (a different backend — see "1. READ ME FIRST — GenBlu
// Integration Brief.md", Option B). Every one of these lands in
// cc_genblu_registrations with source "new_customer", the same subset
// shown in this app's own "New Registration" tab (see /genblu) and served
// back out to them read-only via GET /api/genblu-new-registrations — so
// the two dashboards' "New Registration" lists end up as one shared set,
// not two separately-typed copies of the same customers.
import { createHmac, timingSafeEqual, createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Branch } from "@/lib/branch";

export const runtime = "nodejs";
export const maxDuration = 30;

const SECRET = process.env.GENBLU_INTAKE_SECRET;
const SCREENSHOT_BUCKET = "genblu-screenshots";

interface GenbluPayload {
  id: string;
  submitted_at: string;
  salesperson: string;
  branch: string;
  customer_name: string;
  member_id: string | null;
  reward_points: number | null;
  plate_no: string;
  screenshot_url: string | null;
  ocr_name: string | null;
  mismatch_note: string | null;
  source: "bmm-sales-dashboard";
}

// Their branch label ("Kapar", "Setia Alam", "Puncak Alam") to our own
// lowercase/underscored branch value. An unrecognized label is rejected
// outright rather than guessed at — a silently wrong branch would put the
// registration somewhere staff never think to look for it.
const BRANCH_LABEL_MAP: Record<string, Branch> = {
  kapar: "kapar",
  "setia alam": "setia_alam",
  "puncak alam": "puncak_alam",
};

function mapBranch(label: string): Branch | null {
  return BRANCH_LABEL_MAP[label.trim().toLowerCase()] ?? null;
}

// Same shape as initialsFromName in lib/genblu-actions.ts — duplicated
// rather than imported since that file is "use server" (every export must
// be an async function) and this is a plain, synchronous helper.
function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function signatureValid(rawBody: string, provided: string): boolean {
  if (!SECRET) return false;
  const expected = createHmac("sha256", SECRET).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

// Their screenshot_url is a signed link that expires in 7 days — mirrored
// into our own storage immediately so the photo is still there long after
// that link has died. Best-effort: a failed download shouldn't fail the
// whole registration, since the customer/points data is the part that
// actually matters for the Tracker to be useful.
async function mirrorScreenshot(url: string, branch: Branch): Promise<{ path: string | null; hash: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { path: null, hash: null };
    const buffer = Buffer.from(await res.arrayBuffer());
    const hash = createHash("sha256").update(buffer).digest("hex");
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
    const path = `${branch}/intake-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext.length <= 4 ? ext : "jpg"}`;
    const { error } = await supabaseAdmin.storage.from(SCREENSHOT_BUCKET).upload(path, buffer, { contentType: `image/${ext}` });
    if (error) return { path: null, hash: null };
    return { path, hash };
  } catch {
    return { path: null, hash: null };
  }
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

  let body: GenbluPayload;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.id || !body.customer_name || !body.plate_no || !body.branch || !body.salesperson) {
    return Response.json({ error: "missing required fields" }, { status: 400 });
  }
  const branch = mapBranch(body.branch);
  if (!branch) {
    return Response.json({ error: `unrecognized branch "${body.branch}"` }, { status: 400 });
  }

  // Idempotency — a retry can arrive after a response we never saw, so the
  // same id may be delivered twice. Answer 2xx either way; only the first
  // delivery actually creates a row.
  const { data: existing } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .select("id")
    .eq("external_source_id", body.id)
    .maybeSingle();
  if (existing) {
    return Response.json({ ok: true, duplicate: true });
  }

  const { path: screenshotPath, hash: screenshotHash } = body.screenshot_url
    ? await mirrorScreenshot(body.screenshot_url, branch)
    : { path: null, hash: null };

  const { error } = await supabaseAdmin.from("cc_genblu_registrations").insert({
    branch,
    salesperson_name: body.salesperson,
    salesperson_code: initialsFromName(body.salesperson),
    customer_name: body.customer_name,
    customer_plate_no: body.plate_no,
    member_id: body.member_id,
    // 0 is a real starting balance, not "unknown" — passed through as-is
    // rather than `?? null`, which would be indistinguishable from a
    // customer we never read a points figure for at all.
    points_accrued: body.reward_points,
    screenshot_path: screenshotPath,
    screenshot_hash: screenshotHash,
    name_mismatch_remark: body.mismatch_note,
    external_source_id: body.id,
    source: "new_customer",
    created_at: body.submitted_at || undefined,
  });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}

// Reject other verbs explicitly so a mistake is obvious rather than silent.
export async function GET(): Promise<Response> {
  return Response.json({ error: "POST only" }, { status: 405 });
}
