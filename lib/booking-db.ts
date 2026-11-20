import "server-only";
import { createClient } from "@supabase/supabase-js";

// The online service booking site keeps its own separate database
// (bmm-booking). After-Sales reads its bookings and only writes arrival
// status, daily limits and closed days — never creates or cancels
// bookings (those send customer emails, which the booking site owns).
export const bookingDb = createClient(
  process.env.BOOKING_SUPABASE_URL ?? "http://localhost",
  process.env.BOOKING_SUPABASE_SERVICE_ROLE_KEY ?? "missing",
  { auth: { persistSession: false } }
);

export function bookingDbConfigured(): boolean {
  return Boolean(process.env.BOOKING_SUPABASE_URL && process.env.BOOKING_SUPABASE_SERVICE_ROLE_KEY);
}

// Minutes since midnight, Malaysia time (UTC+8 all year).
export function minutesNowInMalaysia(): number {
  const my = new Date(Date.now() + 8 * 3600_000);
  return my.getUTCHours() * 60 + my.getUTCMinutes();
}

// Called after a jobsheet is saved: the booking for the same plate, branch
// and day is ticked Done if nobody ticked it. Never throws — the jobsheet
// is already saved, and a booking-site hiccup must not undo that.
export async function markBookingDoneFromJobsheet(branch: string, plate: string, date: string, jobNo: string): Promise<void> {
  try {
    if (!bookingDbConfigured()) return;
    const plateNorm = plate.trim().toUpperCase().replace(/[\s-]/g, "");
    if (!plateNorm || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const now = new Date().toISOString();
    const { data } = await bookingDb
      .from("bookings")
      .select("id, status")
      .eq("plate_norm", plateNorm)
      .eq("branch", branch)
      .eq("booking_date", date)
      .neq("status", "cancelled")
      .is("done_at", null);
    for (const b of data ?? []) {
      await bookingDb
        .from("bookings")
        .update({
          done_at: now,
          done_by: null,
          done_jobsheet_no: jobNo,
          ...(b.status === "arrived" ? {} : { status: "arrived", arrived_at: now, status_changed_by: `jobsheet ${jobNo}` }),
        })
        .eq("id", b.id);
      await notifyBookingDone(b.id);
    }
  } catch {
    // best-effort
  }
}

// A booking was ticked Done: the booking site emails "your bike is ready" to the
// email on that booking (once per booking; it decides). Never throws.
export async function notifyBookingDone(bookingId: string): Promise<void> {
  try {
    const secret = process.env.BOOKING_CARD_SECRET;
    if (!secret || !bookingId) return;
    const base = (process.env.BOOKING_SITE_URL ?? "https://bmm-booking.vercel.app").replace(/\/$/, "");
    await fetch(`${base}/api/staff/booking-done`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ bookingId }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    // best-effort: the Done tick is already saved
  }
}

// Called after a finished Walk-in jobsheet is saved: tells the booking site, which emails
// the customer "your bike is ready" if that plate is saved in a customer's app account.
// The booking site decides who gets it and sends each job only once. Never throws.
export async function notifyBikeReady(branch: string, plate: string, jobNo: string, completedDate: string | null | undefined): Promise<void> {
  try {
    const secret = process.env.BOOKING_CARD_SECRET;
    if (!secret || !plate.trim() || !completedDate) return;
    const base = (process.env.BOOKING_SITE_URL ?? "https://bmm-booking.vercel.app").replace(/\/$/, "");
    await fetch(`${base}/api/staff/job-ready`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ jobs: [{ jobNo, plate, branch, completedDate }] }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    // best-effort: the jobsheet is already saved
  }
}
