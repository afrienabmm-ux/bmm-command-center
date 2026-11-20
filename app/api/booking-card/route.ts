// Private link for the separate customer booking app (bmm-booking): given a
// logged-in customer's phone number and saved plates, returns their
// E-Service Card(s) so the app can show them. Read-only, and the same data
// the public /join page already shows for a phone or plate lookup.
import { timingSafeEqual } from "crypto";
import { lookupCustomerCardAction, type MembershipLookup } from "@/lib/customer-registration-actions";
import { STAMP_REWARDS } from "@/lib/membership";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchAllRows } from "@/lib/fetch-all";

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_PLATES = 10;

function authorized(req: Request): boolean {
  const secret = process.env.BOOKING_CARD_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(given);
  return want.length === got.length && timingSafeEqual(want, got);
}

// "  ali  BIN abu " and "Ali bin Abu" are the same name.
function sameName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function isCard(r: unknown): r is MembershipLookup {
  return typeof r === "object" && r !== null && "cardNumber" in r;
}

export async function POST(req: Request): Promise<Response> {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { phone?: unknown; plates?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const plates = Array.isArray(body.plates)
    ? body.plates.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, MAX_PLATES)
    : [];

  try {
    const found = new Map<string, MembershipLookup>();
    const queue = [...plates];

    // A phone number may match several cards (one per bike): look each one up by its plate.
    if (phone.replace(/\D/g, "").length >= 9) {
      const byPhone = await lookupCustomerCardAction(phone);
      if (isCard(byPhone)) found.set(byPhone.cardNumber, byPhone);
      else if ("choices" in byPhone) queue.push(...byPhone.choices.map((c) => c.plateNo));
    }
    // All bikes at the same time (not one after another); results kept in the saved order.
    const results = await Promise.all(queue.map((plate) => lookupCustomerCardAction(plate)));
    for (const r of results) if (isCard(r)) found.set(r.cardNumber, r);

    // Nothing by phone or plate: try the exact full name, but only when exactly
    // ONE card has that name, so a common name never shows a stranger's card.
    const name = typeof body.name === "string" ? sameName(body.name) : "";
    if (found.size === 0 && name.length >= 3) {
      const { data: all, error } = await fetchAllRows((a, b) =>
        supabaseAdmin.from("cc_customer_cards").select("customer_name, plate_no").order("id").range(a, b)
      );
      if (error) throw new Error(error.message);
      const same = (all ?? []).filter((c) => sameName(c.customer_name ?? "") === name);
      if (same.length === 1) {
        const r = await lookupCustomerCardAction(same[0].plate_no);
        if (isCard(r)) found.set(r.cardNumber, r);
      }
    }

    return Response.json({
      cards: [...found.values()],
      rewards: STAMP_REWARDS.map((r) => ({ stamp: r.stamp, label: r.label, icon: r.icon })),
    });
  } catch {
    return Response.json({ error: "lookup failed" }, { status: 500 });
  }
}
