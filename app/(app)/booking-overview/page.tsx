import { redirect } from "next/navigation";
import { getCurrentUser, isManagementLevel } from "@/lib/current-user";
import { bookingDbConfigured } from "@/lib/booking-db";
import { getBookingOverview, type DayCount } from "@/lib/booking-overview";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-neutral-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

// One series, one colour: 30 thin bars from a shared baseline. Hover shows
// the day and value.
function DayBars({ title, data, unit, note }: { title: string; data: DayCount[]; unit: string; note?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-neutral-900">{title}</p>
        <p className="text-sm text-neutral-500 tabular-nums">
          {total} in 30 days
        </p>
      </div>
      {note && <p className="text-xs text-neutral-500 mt-0.5">{note}</p>}
      <div className="mt-4 flex items-end gap-[2px] h-28 border-b border-neutral-200" role="img" aria-label={`${title}, last 30 days`}>
        {data.map((d) => (
          <div key={d.date} className="group relative flex-1 h-full flex items-end">
            <div
              className="w-full rounded-t-[3px] bg-teal-600 group-hover:bg-teal-800"
              style={{ height: d.value ? `${Math.max(4, (d.value / max) * 100)}%` : "0" }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs text-white z-10">
              {shortDate(d.date)}: {d.value} {unit}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-400">
        <span>{shortDate(data[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export default async function BookingOverviewPage() {
  const user = await getCurrentUser();
  if (!user || !isManagementLevel(user.role)) redirect("/");
  if (!bookingDbConfigured()) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Booking Overview" />
        <p className="p-4 md:p-8 text-neutral-600">The online booking site isn&apos;t connected yet.</p>
      </div>
    );
  }

  const o = await getBookingOverview();
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Booking Overview" subtitle="BMM ServiceHub at a glance: visitors, sign-ups, bookings and bikes" />
      <div className="p-4 md:p-8 space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">People</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Visitors today" value={o.visits.visitorsToday} sub={`${o.visits.today} visits today`} />
            <Tile
              label="Visitors, last 7 days"
              value={o.visits.visitors7}
              sub={o.visits.since ? `Counting since ${shortDate(o.visits.since)}` : "Counting starts from today"}
            />
            <Tile label="App customers" value={o.customers.total} sub={`+${o.customers.thisWeek} this week · +${o.customers.thisMonth} this month`} />
            <Tile label="Signed in, last 7 days" value={o.active.last7} sub={`${o.active.last30} in the last 30 days`} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Bookings</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Today" value={o.bookings.today} sub={`${o.bookings.thisWeek} this week`} />
            <Tile label="This month" value={o.bookings.thisMonth} sub={`${o.bookings.online} online · ${o.bookings.cs} by CS`} />
            <Tile label="Done this month" value={pct(o.bookings.done, o.bookings.pastMonth)} sub={`${o.bookings.done} of ${o.bookings.pastMonth} past bookings`} />
            <Tile label="No-shows this month" value={o.bookings.noShow} sub={pct(o.bookings.noShow, o.bookings.pastMonth) + " of past bookings"} />
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          <DayBars title="Visitors per day" data={o.visitorsByDay} unit="visitors" note="Different phones or computers that opened the booking site" />
          <DayBars title="Sign-ups per day" data={o.signupsByDay} unit="sign-ups" />
          <DayBars title="Bookings per day" data={o.bookingsByDay} unit="bookings" note="By the day of the booking, not counting cancelled" />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">By branch</h2>
          <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500">
                  <th className="px-4 py-2.5">Branch</th>
                  <th className="px-4 py-2.5 text-right">Bookings this month</th>
                  <th className="px-4 py-2.5 text-right">Done</th>
                  <th className="px-4 py-2.5 text-right">No-show</th>
                  <th className="px-4 py-2.5">Next 7 days</th>
                  <th className="px-4 py-2.5 text-right">App bikes</th>
                </tr>
              </thead>
              <tbody>
                {o.branches.map((b) => {
                  const fill = b.next7.limit ? Math.min(100, (b.next7.booked / b.next7.limit) * 100) : 0;
                  return (
                    <tr key={b.branch} className="border-t border-neutral-100">
                      <td className="px-4 py-3 font-medium">{branchLabel(b.branch)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.bookingsMonth}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.doneMonth}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.noShowMonth}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-40">
                          <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden" title={`${b.next7.booked} of ${b.next7.limit} places booked`}>
                            <div className="h-full rounded-full bg-teal-600" style={{ width: `${fill}%` }} />
                          </div>
                          <span className="text-xs text-neutral-600 tabular-nums whitespace-nowrap">
                            {b.next7.booked} / {b.next7.limit}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.bikes}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-neutral-100 text-neutral-500">
                  <td className="px-4 py-3" colSpan={5}>
                    App bikes not booked yet
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.bikes.notBooked}</td>
                </tr>
                <tr className="border-t border-neutral-200 font-semibold">
                  <td className="px-4 py-3" colSpan={5}>
                    Total bikes saved in the app
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.bikes.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">A saved bike counts under the branch it was last booked at. The same plate saved in two accounts counts once.</p>
        </section>
      </div>
    </div>
  );
}
