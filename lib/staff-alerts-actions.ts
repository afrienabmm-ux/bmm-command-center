"use server";

import { bookingDb, bookingDbConfigured } from "./booking-db";
import { canViewAllBranches, requirePage } from "./current-user";
import type { Branch } from "./branch";

// Staff alerts: this device gets a pop-up when a new booking comes in.
// Devices are saved in the booking site's database; the booking site sends the alerts.

const BRANCHES: Branch[] = ["kapar", "setia_alam", "puncak_alam"];
const KEY = /^[A-Za-z0-9_-]+={0,2}$/;

type Sub = { endpoint: string; p256dh: string; auth: string };

function cleanSub(raw: unknown): Sub | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof r.endpoint === "string" ? r.endpoint : "";
  const p256dh = typeof r.keys?.p256dh === "string" ? r.keys.p256dh : "";
  const auth = typeof r.keys?.auth === "string" ? r.keys.auth : "";
  if (!endpoint || endpoint.length > 1000) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (url.protocol !== "https:" || host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".")) return null;
  if (!KEY.test(p256dh) || !KEY.test(auth) || p256dh.length > 200 || auth.length > 200) return null;
  return { endpoint, p256dh, auth };
}

export type StaffAlertResult = { ok?: boolean; error?: string; branch?: Branch | "all" };

// Which branch this device is set to, if it is saved.
export async function getStaffAlertBranch(endpoint: string): Promise<StaffAlertResult> {
  await requirePage("bookings");
  if (!bookingDbConfigured() || typeof endpoint !== "string") return { error: "Not connected" };
  const { data } = await bookingDb.from("staff_push_subscriptions").select("branch").eq("endpoint", endpoint).eq("app", "aftersales").maybeSingle();
  if (!data) return { ok: false };
  return { ok: true, branch: (data.branch as Branch | null) ?? "all" };
}

export async function saveStaffAlert(raw: unknown, branch: Branch | "all"): Promise<StaffAlertResult> {
  const user = await requirePage("bookings");
  if (!bookingDbConfigured()) return { error: "The booking site isn't connected." };
  const sub = cleanSub(raw);
  if (!sub) return { error: "This device can't get alerts." };
  const all = canViewAllBranches(user);
  let pick: Branch | "all" = branch === "all" || BRANCHES.includes(branch) ? branch : "all";
  if (!all) pick = user.homeBranch as Branch; // staff only hear about their own branch
  const { error } = await bookingDb.from("staff_push_subscriptions").upsert(
    {
      app: "aftersales",
      branch: pick === "all" ? null : pick,
      staff_name: user.name,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return { error: "Couldn't save. Please try again." };
  return { ok: true, branch: pick };
}

export async function removeStaffAlert(endpoint: string): Promise<StaffAlertResult> {
  await requirePage("bookings");
  if (bookingDbConfigured() && typeof endpoint === "string" && endpoint) {
    await bookingDb.from("staff_push_subscriptions").delete().eq("endpoint", endpoint).eq("app", "aftersales");
  }
  return { ok: true };
}

export async function testStaffAlert(endpoint: string): Promise<StaffAlertResult> {
  await requirePage("bookings");
  const secret = process.env.BOOKING_CARD_SECRET;
  const base = (process.env.BOOKING_SITE_URL ?? "https://bmm-booking.vercel.app").replace(/\/$/, "");
  if (!secret || typeof endpoint !== "string") return { error: "Not connected" };
  try {
    const res = await fetch(`${base}/api/staff/push-test`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ endpoint }),
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as { sent?: number };
    return j.sent ? { ok: true } : { error: "The test alert didn't go through. Turn alerts off and on again." };
  } catch {
    return { error: "The test alert didn't go through." };
  }
}
