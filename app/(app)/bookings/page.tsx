import { requirePage, getActiveBranchSelection, isManagementLevel } from "@/lib/current-user";
import { listBookings, getDaySettings } from "@/lib/booking-actions";
import { bookingDbConfigured, minutesNowInMalaysia } from "@/lib/booking-db";
import { branchLabel } from "@/lib/branch";
import { todayInMalaysia } from "@/lib/malaysia-time";
import PageHeader from "@/components/PageHeader";
import BookingsClient from "./BookingsClient";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const user = await requirePage("bookings");
  const selection = await getActiveBranchSelection(user);

  if (!bookingDbConfigured()) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Bookings" />
        <p className="p-4 md:p-8 text-neutral-600">The online booking site isn&apos;t connected yet.</p>
      </div>
    );
  }

  const [bookings, settings] = await Promise.all([listBookings(selection), getDaySettings()]);
  const canSetLimits = isManagementLevel(user.role) || user.role === "Branch PIC";
  // Morning bookings lose priority at 11am, afternoon at 3pm (Malaysia time).
  const nowMinutes = minutesNowInMalaysia();

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Bookings"
        subtitle={`${selection === "all" ? "All branches" : branchLabel(selection)} — customers who booked a service online or through Customer Service`}
      />
      <div className="p-4 md:p-8">
        <BookingsClient
          bookings={bookings}
          settings={settings}
          activeBranch={selection}
          today={todayInMalaysia()}
          nowMinutes={nowMinutes}
          canSetLimits={canSetLimits}
          isManagement={isManagementLevel(user.role)}
          homeBranch={user.homeBranch}
        />
      </div>
    </div>
  );
}
