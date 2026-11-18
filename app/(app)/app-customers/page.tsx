import { redirect } from "next/navigation";
import { getCurrentUser, isManagementLevel } from "@/lib/current-user";
import { bookingDbConfigured } from "@/lib/booking-db";
import { getAppCustomers } from "@/lib/app-customers";
import PageHeader from "@/components/PageHeader";
import AppCustomersClient from "./AppCustomersClient";

export const dynamic = "force-dynamic";

// Managers only: customers' emails and phone numbers.
export default async function AppCustomersPage() {
  const user = await getCurrentUser();
  if (!user || !isManagementLevel(user.role)) redirect("/");

  if (!bookingDbConfigured()) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="App Customers" />
        <p className="p-4 md:p-8 text-neutral-600">The online booking site isn&apos;t connected yet.</p>
      </div>
    );
  }

  const customers = await getAppCustomers();
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="App Customers" subtitle="Everyone who signed up in the BMM ServiceHub app, with their email, bikes and bookings" />
      <div className="p-4 md:p-8">
        <AppCustomersClient customers={customers} />
      </div>
    </div>
  );
}
