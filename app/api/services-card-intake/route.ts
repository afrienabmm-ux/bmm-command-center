// Receives a new Services Card issuance forwarded from the separate Sales
// Dashboard when a salesperson marks a bike sale "sold" — an E-Services
// Card only ever gets issued for a customer who actually bought their bike
// from us (see addCustomerCardAction's own eligibility check in
// lib/customers-actions.ts), which is exactly the moment their "sold"
// action represents. Same HMAC + bearer-secret pattern as
// /api/genblu-intake, kept on its own secret so the two integrations can
// be rotated/revoked independently.
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateUniqueCardNumber } from "@/lib/card-number";
import type { Branch } from "@/lib/branch";

export const runtime = "nodejs";
export const maxDuration = 15;

const SECRET = process.env.SERVICES_CARD_INTAKE_SECRET;
// 249cc and below only — a 250cc bike itself is NOT eligible.
const MAX_ELIGIBLE_CC = 249;

interface ServicesCardPayload {
  id: string;
  submitted_at: string;
  salesperson: string;
  branch: string;
  customer_name: string;
  customer_phone: string;
  plate_no: string;
  model: string;
  engine_cc: number;
  issued_date: string;
  expiry_date: string | null;
  notes: string | null;
  source: "bmm-sales-dashboard";
}

const BRANCH_LABEL_MAP: Record<string, Branch> = {
  kapar: "kapar",
  "setia alam": "setia_alam",
  "puncak alam": "puncak_alam",
};

function mapBranch(label: string): Branch | null {
  return BRANCH_LABEL_MAP[label.trim().toLowerCase()] ?? null;
}

// Their side sends phone numbers as typed on their own dashboard — spaces,
// dashes, and sometimes the "60" country code prefix ("60 17-921 2141").
// Every number entered directly in this app is plain digits starting with
// "0" (local format, e.g. "0179212141"), so forwarded ones are normalized
// to match: strip every non-digit character, then drop just the leading
// "6" when what's left starts with the "60" country code — "6017..."
// becomes "017...", the same number in local form.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("60") && digits.length >= 10) return digits.slice(1);
  return digits;
}

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

  const raw = await req.text();

  if (req.headers.get("authorization") !== `Bearer ${SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!signatureValid(raw, req.headers.get("x-signature") ?? "")) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }

  let body: ServicesCardPayload;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.id || !body.customer_name || !body.plate_no || !body.branch || !body.salesperson || !body.issued_date) {
    return Response.json({ error: "missing required fields" }, { status: 400 });
  }
  const branch = mapBranch(body.branch);
  if (!branch) {
    return Response.json({ error: `unrecognized branch "${body.branch}"` }, { status: 400 });
  }
  // A card only ever gets issued for an eligible bike — same rule
  // addCustomerCardAction enforces for a card added directly in this app.
  if (typeof body.engine_cc !== "number" || body.engine_cc <= 0) {
    return Response.json({ error: "engine_cc is required and must be a positive number" }, { status: 400 });
  }
  if (body.engine_cc > MAX_ELIGIBLE_CC) {
    return Response.json({ error: `bikes ${MAX_ELIGIBLE_CC + 1}cc and above aren't eligible for a services card`, ok: false }, { status: 422 });
  }

  // Idempotency — a retry can arrive after a response we never saw, so the
  // same id may be delivered twice. Answer 2xx either way; only the first
  // delivery actually issues a card.
  const { data: existing } = await supabaseAdmin
    .from("cc_customer_cards")
    .select("id, card_number")
    .eq("external_source_id", body.id)
    .maybeSingle();
  if (existing) {
    return Response.json({ ok: true, duplicate: true, card_number: existing.card_number });
  }

  const customerPhone = normalizePhone(body.customer_phone?.trim() ?? "");
  if (customerPhone) {
    const { data: phoneMatch } = await supabaseAdmin
      .from("cc_customer_cards")
      .select("id, card_number")
      .eq("customer_phone", customerPhone)
      .limit(1)
      .maybeSingle();
    // A genuine conflict, not a retry of this same sale (that's the
    // external_source_id check above) — this phone number already has a
    // *different* card on file. Flagged as a real error rather than
    // silently issuing a second card or silently dropping this one, since
    // either would need a human to sort out which card is actually right.
    if (phoneMatch) {
      return Response.json(
        { error: `phone ${customerPhone} already has a services card (${phoneMatch.card_number})`, ok: false },
        { status: 409 }
      );
    }
  }

  const cardNumber = await generateUniqueCardNumber(branch);
  const { error } = await supabaseAdmin.from("cc_customer_cards").insert({
    branch,
    customer_name: body.customer_name,
    customer_phone: customerPhone,
    card_number: cardNumber,
    // Lowercased, matching the convention every name in this column uses
    // (see lib/services-card-salespeople.ts) — their dashboard's own
    // casing for a salesperson's name won't always match ours otherwise,
    // and the Services Card filter/dropdown both key off this being
    // consistent.
    salesperson_name: body.salesperson.trim().toLowerCase(),
    plate_no: body.plate_no,
    model: body.model ?? "",
    bought_bike_here: true,
    under_250cc: true,
    issued_date: body.issued_date,
    expiry_date: body.expiry_date || null,
    notes: body.notes ?? "",
    external_source_id: body.id,
    created_at: body.submitted_at || undefined,
  });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, card_number: cardNumber }, { status: 201 });
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "POST only" }, { status: 405 });
}
