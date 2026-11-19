"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Check, CheckCircle2, Circle, Phone, RotateCcw, UserX, Clock, History } from "lucide-react";
import {
  setBookingStatusAction,
  setBookingDoneAction,
  type BookingItem,
  type DaySettings,
  type Session,
} from "@/lib/booking-actions";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";

const SERVICE_LABEL: Record<string, string> = {
  normal_service: "Normal service",
  oil_change: "Oil change",
  repair_check: "Repair / problem check",
  warranty: "Warranty",
  other: "Other",
};

const SESSIONS: { value: Session; label: string; lateAt: number; lateText: string }[] = [
  { value: "am", label: "Morning (AM)", lateAt: 11 * 60, lateText: "11am" },
  { value: "pm", label: "Afternoon (PM)", lateAt: 15 * 60, lateText: "3pm" },
];

function dayLabel(date: string, today: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const label = d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  const diff = Math.round((d.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  return diff === 0 ? `Today, ${label}` : diff === 1 ? `Tomorrow, ${label}` : label;
}

// "10:15" -> 615 minutes; 615 -> "10:15am"
function slotMinutes(slot: string): number {
  const [h, m] = slot.split(":").map(Number);
  return h * 60 + m;
}
function timeText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

function limitFor(settings: DaySettings, branch: Branch, date: string, session: Session): number {
  return settings.overrides.find((o) => o.branch === branch && o.date === date && o.session === session)?.limit ?? settings.defaults[branch][session];
}

type Run = (fn: () => Promise<{ error?: string }>) => void;

export default function BookingsClient({
  bookings,
  settings,
  activeBranch,
  today,
  nowMinutes,
}: {
  bookings: BookingItem[];
  settings: DaySettings;
  activeBranch: BranchSelection;
  today: string;
  nowMinutes: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run: Run = (fn) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
    });

  const branches: Branch[] = activeBranch === "all" ? BRANCHES.map((b) => b.value) : [activeBranch];
  const todays = bookings.filter((b) => b.date === today);
  const upcoming = bookings.filter((b) => b.date > today);
  const past = bookings.filter((b) => b.date < today);
  const pastDates = [...new Set(past.map((b) => b.date))].sort().reverse();
  const upcomingDates = [...new Set(upcoming.map((b) => b.date))];

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-red-600" /> Today&apos;s bookings
        </h2>
        <p className="text-sm text-neutral-500">
          Serve booked customers before walk-ins at their booked time. A customer more than 15 minutes late is served like a walk-in.
        </p>
        {branches.map((branch) => (
          <div key={branch} className="rounded-xl border border-neutral-200 bg-white">
            <div className="px-4 py-3 border-b border-neutral-100 font-semibold">{branchLabel(branch)}</div>
            {SESSIONS.map((s) => {
              const list = todays.filter((b) => b.branch === branch && b.session === s.value);
              // Late = 15 minutes after the customer's own time (old bookings without a time: 11am / 3pm).
              return (
                <div key={s.value} className="border-b border-neutral-100 last:border-b-0">
                  <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-neutral-500">
                      {list.length} / {limitFor(settings, branch, today, s.value)} booked
                    </span>
                  </div>
                  {list.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-neutral-500">No bookings.</p>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {list.map((b) => (
                        <TodayRow
                          key={b.id}
                          b={b}
                          late={b.status === "booked" && nowMinutes >= (b.slotTime ? slotMinutes(b.slotTime) + 15 : s.lateAt)}
                          lateText={b.slotTime ? timeText(slotMinutes(b.slotTime) + 15) : s.lateText}
                          pending={pending}
                          run={run}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-neutral-500" /> Last 7 days
        </h2>
        <p className="text-sm text-neutral-500">
          Tick Done for bookings that were served. A booking is ticked by itself when a jobsheet with the same plate is uploaded for that day.
        </p>
        {pastDates.length === 0 ? (
          <p className="text-sm text-neutral-500">No bookings in the last 7 days.</p>
        ) : (
          pastDates.map((date) => {
            const list = past.filter((b) => b.date === date);
            const done = list.filter((b) => b.doneAt).length;
            return (
              <details key={date} open={done < list.length} className="rounded-xl border border-neutral-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span className="font-semibold w-40">{dayLabel(date, today)}</span>
                  <span className={`text-sm ${done < list.length ? "text-amber-700" : "text-emerald-700"}`}>
                    {done} of {list.length} done
                  </span>
                </summary>
                <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                  {list.map((b) => (
                    <TodayRow key={b.id} b={b} late={false} lateText="" pending={pending} run={run} showBranch={branches.length > 1} />
                  ))}
                </ul>
              </details>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Coming up (next 14 days)</h2>
        {upcomingDates.length === 0 ? (
          <p className="text-sm text-neutral-500">No bookings yet.</p>
        ) : (
          upcomingDates.map((date) => (
            <details key={date} className="rounded-xl border border-neutral-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                <span className="font-semibold w-40">{dayLabel(date, today)}</span>
                {branches.map((br) => (
                  <span key={br} className="text-sm text-neutral-600">
                    {branchLabel(br)}:{" "}
                    {SESSIONS.map(
                      (s) =>
                        `${s.value.toUpperCase()} ${upcoming.filter((b) => b.date === date && b.branch === br && b.session === s.value).length}/${limitFor(settings, br, date, s.value)}`
                    ).join(" · ")}
                  </span>
                ))}
              </summary>
              <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                {upcoming
                  .filter((b) => b.date === date)
                  .map((b) => (
                    <li key={b.id} className="px-4 py-2 text-sm flex flex-wrap gap-x-4">
                      <span className="font-semibold w-16">{b.slotTime ? timeText(slotMinutes(b.slotTime)) : b.session.toUpperCase()}</span>
                      <span className="font-mono font-bold w-36">{b.bookingNo}</span>
                      <span>
                        {b.name} · {b.plate} · {b.bikeModel}
                        {b.mileageKm != null ? ` · ${b.mileageKm.toLocaleString("en-US")} km` : ""} · {SERVICE_LABEL[b.serviceType] ?? b.serviceType} · {b.phone}
                      </span>
                    </li>
                  ))}
              </ul>
            </details>
          ))
        )}
      </section>

    </div>
  );
}

function TodayRow({
  b,
  late,
  lateText,
  pending,
  run,
  showBranch = false,
}: {
  b: BookingItem;
  late: boolean;
  lateText: string;
  pending: boolean;
  run: Run;
  showBranch?: boolean;
}) {
  return (
    <li className="px-4 py-3 flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 min-w-0 flex-1">
      <span className="shrink-0 rounded-lg bg-neutral-900 text-white px-2 py-1 text-sm font-bold w-20 text-center">
        {b.slotTime ? timeText(slotMinutes(b.slotTime)) : b.session.toUpperCase()}
      </span>
      <span className="font-mono text-lg font-bold sm:w-36 shrink-0">{b.bookingNo}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {b.name} · {b.plate}
          {showBranch ? <span className="text-neutral-500 font-normal"> · {branchLabel(b.branch)}</span> : null}
        </p>
        <p className="text-neutral-500">
          {b.bikeModel}
          {b.mileageKm != null ? ` · ${b.mileageKm.toLocaleString("en-US")} km` : ""} · {SERVICE_LABEL[b.serviceType] ?? b.serviceType} ·{" "}
          <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 underline">
            <Phone className="w-3 h-3" />
            {b.phone}
          </a>
          {b.source === "cs" && <> · booked by CS{b.createdByName ? ` (${b.createdByName})` : ""}</>}
        </p>
      </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {late && !b.doneAt && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs" title={`Not here by ${lateText}`}>
            <Clock className="w-3 h-3" /> Late – walk-in priority
          </span>
        )}
        {b.status === "booked" ? (
          <>
            <button
              disabled={pending}
              onClick={() => run(() => setBookingStatusAction(b.id, "arrived"))}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Arrived
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => setBookingStatusAction(b.id, "no_show"))}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <UserX className="w-4 h-4" /> No-show
            </button>
          </>
        ) : (
          <>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                b.status === "arrived" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-700"
              }`}
            >
              {b.status === "arrived" ? "Arrived" : "No-show"}
              {b.statusChangedBy ? ` · ${b.statusChangedBy}` : ""}
            </span>
            <button
              disabled={pending}
              title="Undo"
              aria-label="Undo"
              onClick={() => run(() => setBookingStatusAction(b.id, "booked"))}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>
        )}
        {b.doneAt ? (
          <button
            disabled={pending}
            onClick={() => run(() => setBookingDoneAction(b.id, false))}
            title="Click to untick"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" /> Done
            <span className="font-normal opacity-90">
              {b.doneJobsheetNo ? `(jobsheet ${b.doneJobsheetNo})` : b.doneBy ? `· ${b.doneBy}` : ""}
            </span>
          </button>
        ) : (
          <button
            disabled={pending}
            onClick={() => run(() => setBookingDoneAction(b.id, true))}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 text-emerald-700 px-3 py-1.5 text-sm font-medium hover:bg-emerald-50 disabled:opacity-50"
          >
            <Circle className="w-4 h-4" /> Done
          </button>
        )}
      </div>
    </li>
  );
}
