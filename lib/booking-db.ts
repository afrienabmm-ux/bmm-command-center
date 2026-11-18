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
    }
  } catch {
    // best-effort
  }
}
