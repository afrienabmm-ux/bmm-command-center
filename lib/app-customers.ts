import "server-only";
import { bookingDb } from "./booking-db";
import { fetchAllRows } from "./fetch-all";

// People who made an account in the customer booking app (BMM ServiceHub).
// Read-only: this never changes anything on the booking site.

export type AppCustomerBike = { plate: string; model: string; mileageKm: number | null };
export type AppCustomerBooking = {
  bookingNo: string;
  branch: string;
  date: string;
  session: string;
  slotTime: string | null;
  plate: string;
  status: string;
};
export type AppCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  lang: string;
  joinedAt: string;
  bikes: AppCustomerBike[];
  bookings: AppCustomerBooking[]; // newest first
};

type CustomerRow = { id: string; name: string; phone: string; email: string; lang: string; created_at: string };
type BikeRow = { id: string; customer_id: string; plate: string; model: string; mileage_km: number | null };
type BookingRow = {
  id: string;
  customer_id: string;
  booking_no: string;
  branch: string;
  booking_date: string;
  session: string;
  slot_time: string | null;
  plate: string;
  status: string;
};

export async function getAppCustomers(): Promise<AppCustomer[]> {
  const [customers, bikes, bookings] = await Promise.all([
    fetchAllRows<CustomerRow>((a, b) =>
      bookingDb.from("customers").select("id, name, phone, email, lang, created_at").order("id").range(a, b)
    ),
    fetchAllRows<BikeRow>((a, b) =>
      bookingDb.from("customer_bikes").select("id, customer_id, plate, model, mileage_km").order("id").range(a, b)
    ),
    fetchAllRows<BookingRow>((a, b) =>
      bookingDb
        .from("bookings")
        .select("id, customer_id, booking_no, branch, booking_date, session, slot_time, plate, status")
        .not("customer_id", "is", null)
        .order("id")
        .range(a, b)
    ),
  ]);
  if (customers.error) throw new Error(customers.error.message);
  if (bikes.error) throw new Error(bikes.error.message);
  if (bookings.error) throw new Error(bookings.error.message);

  const bikesBy = new Map<string, AppCustomerBike[]>();
  for (const b of bikes.data) {
    const list = bikesBy.get(b.customer_id) ?? [];
    list.push({ plate: b.plate, model: b.model, mileageKm: b.mileage_km });
    bikesBy.set(b.customer_id, list);
  }
  const bookingsBy = new Map<string, AppCustomerBooking[]>();
  for (const b of bookings.data) {
    const list = bookingsBy.get(b.customer_id) ?? [];
    list.push({
      bookingNo: b.booking_no,
      branch: b.branch,
      date: b.booking_date,
      session: b.session,
      slotTime: b.slot_time,
      plate: b.plate,
      status: b.status,
    });
    bookingsBy.set(b.customer_id, list);
  }

  return customers.data
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      lang: c.lang,
      joinedAt: c.created_at,
      bikes: bikesBy.get(c.id) ?? [],
      bookings: (bookingsBy.get(c.id) ?? []).sort((x, y) => y.date.localeCompare(x.date)),
    }))
    .sort((x, y) => y.joinedAt.localeCompare(x.joinedAt));
}
