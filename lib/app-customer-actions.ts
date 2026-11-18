"use server";

import { revalidatePath } from "next/cache";
import { bookingDb } from "./booking-db";
import { getCurrentUser, isManagementLevel } from "./current-user";
import { logActivity } from "./activity-log";
import { todayInMalaysia } from "./malaysia-time";

// Deletes a customer's app account (Management only). Upcoming bookings are
// cancelled first through the booking site, so the customer gets the normal
// cancellation email and the slot frees up. Past bookings stay as shop
// records (the booking site keeps them, just no longer linked to an account).
export async function deleteAppCustomerAction(customerId: string): Promise<{ error?: string; cancelled?: number }> {
  try {
    const user = await getCurrentUser();
    if (!user || !isManagementLevel(user.role)) return { error: "Only Management can delete customer accounts." };
    if (!/^[0-9a-f-]{36}$/i.test(customerId)) return { error: "Customer not found." };

    const { data: customer } = await bookingDb.from("customers").select("id, name, email").eq("id", customerId).single();
    if (!customer) return { error: "Customer not found." };

    const { data: upcoming, error: upErr } = await bookingDb
      .from("bookings")
      .select("id, booking_no")
      .eq("customer_id", customerId)
      .eq("status", "booked")
      .gte("booking_date", todayInMalaysia());
    if (upErr) return { error: "Couldn't check the customer's bookings." };

    if ((upcoming ?? []).length > 0) {
      const site = process.env.BOOKING_SITE_URL;
      const secret = process.env.BOOKING_STAFF_SECRET;
      if (!site || !secret) {
        return {
          error: `${customer.name} has ${upcoming!.length} upcoming booking(s). Cancel them on the Bookings page first (cancelling from here isn't switched on yet).`,
        };
      }
      for (const b of upcoming!) {
        const res = await fetch(`${site.replace(/\/$/, "")}/api/staff/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
          body: JSON.stringify({ action: "cancel", id: b.id }),
        }).catch(() => null);
        const body = res && res.ok ? ((await res.json().catch(() => null)) as { result?: string } | null) : null;
        if (!body || !["cancelled", "already_cancelled"].includes(body.result ?? "")) {
          return { error: `Couldn't cancel booking ${b.booking_no}, so the account was not deleted. Try again.` };
        }
      }
    }

    // Removing the login also removes the customer row and saved bikes; their
    // bookings stay with customer_id cleared.
    const { error: delErr } = await bookingDb.auth.admin.deleteUser(customerId);
    if (delErr) return { error: "Couldn't delete the account." };

    await logActivity(
      user,
      "Deleted app customer",
      `${customer.name} (${customer.email})${upcoming?.length ? `, ${upcoming.length} upcoming booking(s) cancelled` : ""}`
    );
    revalidatePath("/app-customers");
    revalidatePath("/booking-overview");
    revalidatePath("/bookings");
    return { cancelled: upcoming?.length ?? 0 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't delete the account." };
  }
}
