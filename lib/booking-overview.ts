import "server-only";
import { bookingDb } from "./booking-db";
import { fetchAllRows } from "./fetch-all";
import { todayInMalaysia } from "./malaysia-time";
import { BRANCHES, type Branch } from "./branch";

// Numbers for the Booking Overview page — read-only.

export type DayCount = { date: string; value: number };
export type BranchRow = {
  branch: Branch;
  bookingsMonth: number;
  doneMonth: number;
  noShowMonth: number;
  next7: { booked: number; limit: number };
  bikes: number;
};
export type BookingOverview = {
  customers: { total: number; thisWeek: number; thisMonth: number };
  active: { last7: number; last30: number };
  visits: { today: number; visitorsToday: number; visitors7: number; visitors30: number; since: string | null };
  bookings: { today: number; thisWeek: number; thisMonth: number; online: number; cs: number; done: number; noShow: number; pastMonth: number };
  bikes: { total: number; notBooked: number };
  branches: BranchRow[];
  signupsByDay: DayCount[];
  visitorsByDay: DayCount[];
  bookingsByDay: DayCount[];
};

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function myDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
// Monday of this week (Malaysia time)
function weekStart(today: string): string {
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(today, -dow);
}

type BookingRow = {
  branch: Branch;
  booking_date: string;
  status: string;
  source: string;
  done_at: string | null;
  plate_norm: string;
};

export async function getBookingOverview(): Promise<BookingOverview> {
  const today = todayInMalaysia();
  const from30 = addDays(today, -29);
  const monthStart = `${today.slice(0, 7)}-01`;
  const week = weekStart(today);

  const [customers, bikes, bookings, visits, settings, overrides] = await Promise.all([
    fetchAllRows<{ id: string; created_at: string }>((a, b) => bookingDb.from("customers").select("id, created_at").order("id").range(a, b)),
    fetchAllRows<{ customer_id: string; plate_norm: string }>((a, b) =>
      bookingDb.from("customer_bikes").select("customer_id, plate_norm").order("id").range(a, b)
    ),
    fetchAllRows<BookingRow>((a, b) =>
      bookingDb.from("bookings").select("branch, booking_date, status, source, done_at, plate_norm").neq("status", "cancelled").order("id").range(a, b)
    ),
    bookingDb.from("site_visits").select("day, visits, visitors").gte("day", from30).order("day"),
    bookingDb.from("branch_settings").select("branch, am_limit, pm_limit"),
    bookingDb.from("day_limit_overrides").select("branch, booking_date, session, daily_limit").gte("booking_date", today),
  ]);
  if (customers.error) throw new Error(customers.error.message);
  if (bikes.error) throw new Error(bikes.error.message);
  if (bookings.error) throw new Error(bookings.error.message);

  // Sign-ins: Supabase keeps each account's last sign-in time.
  const lastSignIn: string[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await bookingDb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) if (u.last_sign_in_at) lastSignIn.push(myDate(u.last_sign_in_at));
    if (data.users.length < 1000) break;
  }

  const joined = customers.data.map((c) => myDate(c.created_at));
  const days30 = Array.from({ length: 30 }, (_, i) => addDays(from30, i));
  const countBy = (dates: string[]) => {
    const m = new Map<string, number>();
    for (const d of dates) m.set(d, (m.get(d) ?? 0) + 1);
    return days30.map((date) => ({ date, value: m.get(date) ?? 0 }));
  };

  const visitRows = (visits.data ?? []) as { day: string; visits: number; visitors: number }[];
  const visitMap = new Map(visitRows.map((v) => [v.day, v]));
  const { data: firstVisit } = await bookingDb.from("site_visits").select("day").order("day").limit(1);

  const b = bookings.data;
  const inMonth = b.filter((x) => x.booking_date >= monthStart && x.booking_date <= today);
  const pastMonth = inMonth.filter((x) => x.booking_date < today);

  // Bikes per branch: the branch the bike was last booked at.
  const lastBranch = new Map<string, { date: string; branch: Branch }>();
  for (const x of b) {
    const cur = lastBranch.get(x.plate_norm);
    if (!cur || x.booking_date > cur.date) lastBranch.set(x.plate_norm, { date: x.booking_date, branch: x.branch });
  }
  const bikePlates = [...new Set(bikes.data.map((x) => x.plate_norm))];

  const limits = new Map<string, { am: number; pm: number }>();
  for (const r of settings.data ?? []) limits.set(r.branch, { am: r.am_limit, pm: r.pm_limit });
  const overrideMap = new Map((overrides.data ?? []).map((o) => [`${o.branch}:${o.booking_date}:${o.session}`, o.daily_limit as number]));
  const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));

  const branches: BranchRow[] = BRANCHES.map(({ value }) => {
    const mine = inMonth.filter((x) => x.branch === value);
    const lim = limits.get(value) ?? { am: 5, pm: 5 };
    return {
      branch: value,
      bookingsMonth: mine.length,
      doneMonth: mine.filter((x) => x.done_at).length,
      noShowMonth: mine.filter((x) => x.status === "no_show").length,
      next7: {
        booked: b.filter((x) => x.branch === value && next7.includes(x.booking_date)).length,
        limit: next7.reduce(
          (s, d) => s + (overrideMap.get(`${value}:${d}:am`) ?? lim.am) + (overrideMap.get(`${value}:${d}:pm`) ?? lim.pm),
          0
        ),
      },
      bikes: bikePlates.filter((p) => lastBranch.get(p)?.branch === value).length,
    };
  });

  return {
    customers: {
      total: customers.data.length,
      thisWeek: joined.filter((d) => d >= week).length,
      thisMonth: joined.filter((d) => d >= monthStart).length,
    },
    active: {
      last7: lastSignIn.filter((d) => d >= addDays(today, -6)).length,
      last30: lastSignIn.filter((d) => d >= from30).length,
    },
    visits: {
      today: visitMap.get(today)?.visits ?? 0,
      visitorsToday: visitMap.get(today)?.visitors ?? 0,
      visitors7: visitRows.filter((v) => v.day >= addDays(today, -6)).reduce((s, v) => s + v.visitors, 0),
      visitors30: visitRows.reduce((s, v) => s + v.visitors, 0),
      since: firstVisit?.[0]?.day ?? null,
    },
    bookings: {
      today: b.filter((x) => x.booking_date === today).length,
      thisWeek: b.filter((x) => x.booking_date >= week && x.booking_date <= addDays(week, 6)).length,
      thisMonth: inMonth.length,
      online: inMonth.filter((x) => x.source === "online").length,
      cs: inMonth.filter((x) => x.source === "cs").length,
      done: pastMonth.filter((x) => x.done_at).length,
      noShow: pastMonth.filter((x) => x.status === "no_show").length,
      pastMonth: pastMonth.length,
    },
    bikes: { total: bikePlates.length, notBooked: bikePlates.filter((p) => !lastBranch.has(p)).length },
    branches,
    signupsByDay: countBy(joined),
    visitorsByDay: days30.map((date) => ({ date, value: visitMap.get(date)?.visitors ?? 0 })),
    bookingsByDay: countBy(b.filter((x) => x.booking_date >= from30 && x.booking_date <= today).map((x) => x.booking_date)),
  };
}
