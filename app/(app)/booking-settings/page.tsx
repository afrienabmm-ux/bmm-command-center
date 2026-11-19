import { redirect } from "next/navigation";
import { getCurrentUser, isManagementLevel } from "@/lib/current-user";
import { listBookings, getDaySettings } from "@/lib/booking-actions";
import { bookingDbConfigured } from "@/lib/booking-db";
import { todayInMalaysia } from "@/lib/malaysia-time";
import PageHeader from "@/components/PageHeader";
import BookingSettingsClient from "./BookingSettingsClient";

export const dynamic = "force-dynamic";

// Daily booking limits and closed days. Management and Branch PIC (their own branch) only.
export default async function BookingSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !(isManagementLevel(user.role) || user.role === "Branch PIC")) redirect("/");

  if (!bookingDbConfigured()) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Booking Settings" />
        <p className="p-4 md:p-8 text-neutral-600">The online booking site isn&apos;t connected yet.</p>
      </div>
    );
  }

  const [bookings, settings] = await Promise.all([listBookings("all"), getDaySettings()]);
  const today = todayInMalaysia();
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Booking Settings" subtitle="How many customers can book each day, and the days we are closed" />
      <div className="p-4 md:p-8">
        <BookingSettingsClient
          bookings={bookings.filter((b) => b.date > today)}
          settings={settings}
          today={today}
          isManagement={isManagementLevel(user.role)}
          homeBranch={user.homeBranch}
        />
      </div>
    </div>
  );
}
