// Private link for the separate customer booking app (bmm-booking): returns a
// logged-in customer's own service history from uploaded job sheets.
// A job sheet is only returned when BOTH its phone number AND its plate match
// the customer's account (phone + one of their saved bikes), because the
// app's phone number isn't verified and history shows spending and work done.
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchAllRows } from "@/lib/fetch-all";
import { normalizePlate } from "@/lib/plate";

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_PLATES = 10;
const MAX_JOBS = 50;

function authorized(req: Request): boolean {
  const secret = process.env.BOOKING_CARD_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(given);
  return want.length === got.length && timingSafeEqual(want, got);
}

// "+60 12-345 6789", "012 3456789" and "60123456789" all become "0123456789".
function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("60")) d = "0" + d.slice(2);
  return d;
}

type JobRow = {
  id: string;
  job_no: string;
  branch: string;
  plate_no: string;
  customer_phone: string;
  started_date: string;
  completed_date: string | null;
  status: string;
  model: string;
  mileage_km: string;
  next_mileage_km: string;
  next_service_date: string;
  service_type: string;
  description: string;
  revenue_amount: number;
};

export async function POST(req: Request): Promise<Response> {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { phone?: unknown; plates?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  const plates = new Set(
    (Array.isArray(body.plates) ? body.plates : [])
      .filter((p): p is string => typeof p === "string")
      .slice(0, MAX_PLATES)
      .map(normalizePlate)
      .filter(Boolean)
  );
  if (phone.length < 9 || plates.size === 0) return Response.json({ jobs: [] });

  try {
    const { data, error } = await fetchAllRows((a, b) =>
      supabaseAdmin
        .from("cc_repair_jobs")
        .select(
          "id, job_no, branch, plate_no, customer_phone, started_date, completed_date, status, model, mileage_km, next_mileage_km, next_service_date, service_type, description, revenue_amount"
        )
        .eq("job_type", "Walk-in")
        .order("id")
        .range(a, b)
    );
    if (error) throw new Error(error.message);

    const mine = ((data ?? []) as JobRow[])
      .filter((j) => plates.has(normalizePlate(j.plate_no ?? "")) && normalizePhone(j.customer_phone ?? "") === phone)
      .sort((x, y) => (y.started_date ?? "").localeCompare(x.started_date ?? ""))
      .slice(0, MAX_JOBS);

    const items = new Map<string, { description: string; quantity: number; price: number }[]>();
    if (mine.length) {
      const { data: rows, error: itemsError } = await supabaseAdmin
        .from("cc_repair_job_items")
        .select("job_id, description, quantity, price, sort_order")
        .in(
          "job_id",
          mine.map((j) => j.id)
        )
        .order("sort_order");
      if (itemsError) throw new Error(itemsError.message);
      for (const r of rows ?? []) {
        const list = items.get(r.job_id) ?? [];
        list.push({ description: r.description, quantity: Number(r.quantity), price: Number(r.price) });
        items.set(r.job_id, list);
      }
    }

    return Response.json({
      jobs: mine.map((j) => ({
        jobNo: j.job_no,
        branch: j.branch,
        plateNo: j.plate_no,
        model: j.model,
        date: j.completed_date ?? j.started_date,
        status: j.status,
        mileageKm: j.mileage_km,
        nextMileageKm: j.next_mileage_km,
        nextServiceDate: j.next_service_date,
        serviceType: j.service_type.replace(/^[\s*:]+/, "").trim(),
        description: j.description,
        total: Number(j.revenue_amount),
        items: items.get(j.id) ?? [],
      })),
    });
  } catch {
    return Response.json({ error: "lookup failed" }, { status: 500 });
  }
}
