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
