// Private link for the separate customer booking app (bmm-booking): given a
// logged-in customer's phone number and saved plates, returns their
// E-Service Card(s) so the app can show them. Read-only, and the same data
// the public /join page already shows for a phone or plate lookup.
import { timingSafeEqual } from "crypto";
import { lookupCustomerCardAction, type MembershipLookup } from "@/lib/customer-registration-actions";
import { STAMP_REWARDS } from "@/lib/membership";

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

function isCard(r: unknown): r is MembershipLookup {
  return typeof r === "object" && r !== null && "cardNumber" in r;
}

export async function POST(req: Request): Promise<Response> {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { phone?: unknown; plates?: unknown };
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
    for (const plate of queue) {
      const r = await lookupCustomerCardAction(plate);
      if (isCard(r)) found.set(r.cardNumber, r);
    }

    return Response.json({
      cards: [...found.values()],
      rewards: STAMP_REWARDS.map((r) => ({ stamp: r.stamp, label: r.label, icon: r.icon })),
    });
  } catch {
    return Response.json({ error: "lookup failed" }, { status: 500 });
  }
}
