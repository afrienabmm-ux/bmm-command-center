import { requirePage, getActiveBranchSelection, isManagementLevel, canViewAllBranches } from "@/lib/current-user";
import { listBookings, getDaySettings } from "@/lib/booking-actions";
import { bookingDbConfigured, minutesNowInMalaysia } from "@/lib/booking-db";
import { branchLabel } from "@/lib/branch";
import { todayInMalaysia } from "@/lib/malaysia-time";
import Link from "next/link";
import { Settings } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BookingsClient from "./BookingsClient";
import StaffAlerts from "@/components/StaffAlerts";

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
        action={
          canSetLimits ? (
            <Link href="/booking-settings" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              <Settings className="w-4 h-4" />
              Limits &amp; closed days
            </Link>
          ) : undefined
        }
      />
      <div className="p-4 md:p-8">
        <StaffAlerts canPickAll={canViewAllBranches(user)} defaultBranch={selection} />
        <BookingsClient
          bookings={bookings}
          settings={settings}
          activeBranch={selection}
          today={todayInMalaysia()}
          nowMinutes={nowMinutes}
        />
      </div>
    </div>
  );
}
