"use server";

import { revalidatePath } from "next/cache";
import { bookingDb } from "./booking-db";
import { requirePage, assertCanEditBranch, isManagementLevel, type CurrentUser } from "./current-user";
import type { Branch } from "./branch";
import { BRANCHES } from "./branch";
import { todayInMalaysia } from "./malaysia-time";

export type BookingStatus = "booked" | "arrived" | "no_show" | "cancelled";
export type Session = "am" | "pm";

export type BookingItem = {
  id: string;
  bookingNo: string;
  branch: Branch;
  date: string;
  session: Session;
  slotTime: string | null; // "09:30" etc.; null for bookings made before times existed
  seq: number;
  name: string;
  phone: string;
  plate: string;
  bikeModel: string;
  mileageKm: number | null;
  serviceType: string;
  status: BookingStatus;
  source: "online" | "cs";
  createdByName: string | null;
  statusChangedBy: string | null;
  doneAt: string | null;
  doneBy: string | null;
  doneJobsheetNo: string | null;
};

export type DaySettings = {
  defaults: Record<Branch, Record<Session, number>>;
  overrides: { branch: Branch; date: string; session: Session; limit: number }[];
  closed: { id: string; branch: Branch | null; date: string; note: string | null }[];
};

const BRANCH_VALUES = BRANCHES.map((b) => b.value);

function isBranch(v: unknown): v is Branch {
  return typeof v === "string" && (BRANCH_VALUES as string[]).includes(v);
}

function isSession(v: unknown): v is Session {
  return v === "am" || v === "pm";
}

function isDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Limits and closed days: Management/Administrator for any branch, Branch PIC for their own.
function assertCanSetLimits(user: CurrentUser, branch: Branch | null) {
  if (isManagementLevel(user.role)) return;
  if (user.role === "Branch PIC" && branch !== null && user.homeBranch === branch) return;
  throw new Error(
    branch === null ? "Only Management can close all branches at once." : "Only the branch manager or Management can change limits and closed days."
  );
}

// Last 7 days are included so a booking nobody ticked can still be marked Done.
export async function listBookings(branch: Branch | "all", days = 14, pastDays = 7): Promise<BookingItem[]> {
  await requirePage("bookings");
  const today = todayInMalaysia();
  let q = bookingDb
    .from("bookings")
    .select("id, booking_no, branch, booking_date, session, slot_time, seq, name, phone, plate, bike_model, mileage_km, service_type, status, source, created_by_name, status_changed_by, done_at, done_by, done_jobsheet_no")
    .gte("booking_date", addDays(today, -pastDays))
    .lte("booking_date", addDays(today, days))
    .neq("status", "cancelled")
    .order("booking_date")
    .order("branch")
    .order("session")
    .order("slot_time", { nullsFirst: false })
    .order("seq");
  if (branch !== "all") q = q.eq("branch", branch);
  const { data, error } = await q;
  if (error) throw new Error("Couldn't load bookings.");
  return (data ?? []).map((r) => ({
    id: r.id,
    bookingNo: r.booking_no,
    branch: r.branch,
    date: r.booking_date,
    session: r.session,
    slotTime: r.slot_time ?? null,
    seq: r.seq,
    name: r.name,
    phone: r.phone,
    plate: r.plate,
    bikeModel: r.bike_model,
    mileageKm: r.mileage_km,
    serviceType: r.service_type,
    status: r.status,
    source: r.source,
    createdByName: r.created_by_name,
    statusChangedBy: r.status_changed_by,
    doneAt: r.done_at ?? null,
    doneBy: r.done_by ?? null,
    doneJobsheetNo: r.done_jobsheet_no ?? null,
  }));
}

export async function getDaySettings(): Promise<DaySettings> {
  await requirePage("bookings");
  const today = todayInMalaysia();
  const [s, o, c] = await Promise.all([
    bookingDb.from("branch_settings").select("branch, am_limit, pm_limit"),
    bookingDb.from("day_limit_overrides").select("branch, booking_date, session, daily_limit").gte("booking_date", today).order("booking_date"),
    bookingDb.from("closed_days").select("id, branch, closed_date, note").gte("closed_date", today).order("closed_date"),
  ]);
  if (s.error || o.error || c.error) throw new Error("Couldn't load booking limits.");
  const defaults = {
    kapar: { am: 5, pm: 5 },
    setia_alam: { am: 5, pm: 5 },
    puncak_alam: { am: 5, pm: 5 },
  } as Record<Branch, Record<Session, number>>;
  for (const r of s.data ?? []) if (isBranch(r.branch)) defaults[r.branch] = { am: r.am_limit, pm: r.pm_limit };
  return {
    defaults,
    overrides: (o.data ?? []).map((r) => ({ branch: r.branch, date: r.booking_date, session: r.session, limit: r.daily_limit })),
    closed: (c.data ?? []).map((r) => ({ id: r.id, branch: r.branch, date: r.closed_date, note: r.note })),
  };
}

export async function setBookingStatusAction(id: string, status: "arrived" | "no_show" | "booked"): Promise<{ error?: string }> {
  try {
    const user = await requirePage("bookings");
    const { data: b, error } = await bookingDb.from("bookings").select("branch, status").eq("id", id).single();
    if (error || !b) return { error: "Booking not found." };
    assertCanEditBranch(user, b.branch);
    if (b.status === "cancelled") return { error: "This booking was cancelled." };
    const { error: upErr } = await bookingDb
      .from("bookings")
      .update({
        status,
        arrived_at: status === "arrived" ? new Date().toISOString() : null,
        status_changed_by: status === "booked" ? null : user.name,
      })
      .eq("id", id);
    if (upErr) return { error: "Couldn't update the booking." };
    revalidatePath("/bookings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't update the booking." };
  }
}

// Done tick. Ticking Done also counts the customer as arrived.
export async function setBookingDoneAction(id: string, done: boolean): Promise<{ error?: string }> {
  try {
    const user = await requirePage("bookings");
    const { data: b, error } = await bookingDb.from("bookings").select("branch, status").eq("id", id).single();
    if (error || !b) return { error: "Booking not found." };
    assertCanEditBranch(user, b.branch);
    if (b.status === "cancelled") return { error: "This booking was cancelled." };
    const update: Record<string, unknown> = done
      ? { done_at: new Date().toISOString(), done_by: user.name, done_jobsheet_no: null }
      : { done_at: null, done_by: null, done_jobsheet_no: null };
    if (done && b.status !== "arrived") Object.assign(update, { status: "arrived", arrived_at: new Date().toISOString(), status_changed_by: user.name });
    const { error: upErr } = await bookingDb.from("bookings").update(update).eq("id", id);
    if (upErr) return { error: "Couldn't update the booking." };
    revalidatePath("/bookings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't update the booking." };
  }
}

export async function setDefaultLimitAction(branch: Branch, session: Session, limit: number): Promise<{ error?: string }> {
  try {
    const user = await requirePage("bookings");
    if (!isBranch(branch) || !isSession(session) || !Number.isInteger(limit) || limit < 0 || limit > 100)
      return { error: "Enter a number from 0 to 100." };
    assertCanSetLimits(user, branch);
    const { error } = await bookingDb
      .from("branch_settings")
      .update({ [session === "am" ? "am_limit" : "pm_limit"]: limit, updated_by: user.name, updated_at: new Date().toISOString() })
      .eq("branch", branch);
    if (error) return { error: "Couldn't save the limit." };
    revalidatePath("/bookings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save the limit." };
  }
}

// limit = null removes the single-day change, so the branch's normal limit applies again.
export async function setDayLimitAction(branch: Branch, date: string, session: Session, limit: number | null): Promise<{ error?: string }> {
  try {
    const user = await requirePage("bookings");
    if (!isBranch(branch) || !isDate(date) || !isSession(session)) return { error: "Pick a branch, a day and AM or PM." };
    if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 100)) return { error: "Enter a number from 0 to 100." };
    assertCanSetLimits(user, branch);
    const { error } =
      limit === null
        ? await bookingDb.from("day_limit_overrides").delete().eq("branch", branch).eq("booking_date", date).eq("session", session)
        : await bookingDb
            .from("day_limit_overrides")
            .upsert({ branch, booking_date: date, session, daily_limit: limit, updated_by: user.name, updated_at: new Date().toISOString() });
    if (error) return { error: "Couldn't save the day's limit." };
    revalidatePath("/bookings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save the day's limit." };
  }
}

// branch = null closes all three branches (e.g. a public holiday).
export async function addClosedDayAction(branch: Branch | null, date: string, note: string): Promise<{ error?: string }> {
  try {
    const user = await requirePage("bookings");
    if ((branch !== null && !isBranch(branch)) || !isDate(date)) return { error: "Pick a day." };
    assertCanSetLimits(user, branch);
    const { error } = await bookingDb
      .from("closed_days")
      .insert({ branch, closed_date: date, note: note.trim().slice(0, 100) || null, created_by: user.name });
    if (error) return { error: error.code === "23505" ? "That day is already closed." : "Couldn't save the closed day." };
    revalidatePath("/bookings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save the closed day." };
  }
}

export async function removeClosedDayAction(id: string): Promise<{ error?: string }> {
  try {
    const user = await requirePage("bookings");
    const { data: row } = await bookingDb.from("closed_days").select("branch").eq("id", id).single();
    if (!row) return { error: "Not found." };
    assertCanSetLimits(user, row.branch);
    const { error } = await bookingDb.from("closed_days").delete().eq("id", id);
    if (error) return { error: "Couldn't reopen the day." };
    revalidatePath("/bookings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't reopen the day." };
  }
}
