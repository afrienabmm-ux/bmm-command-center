"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Check, Phone, RotateCcw, UserX, Lock, Unlock, Clock } from "lucide-react";
import {
  setBookingStatusAction,
  setDefaultLimitAction,
  setDayLimitAction,
  addClosedDayAction,
  removeClosedDayAction,
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
  canSetLimits,
  isManagement,
  homeBranch,
}: {
  bookings: BookingItem[];
  settings: DaySettings;
  activeBranch: BranchSelection;
  today: string;
  nowMinutes: number;
  canSetLimits: boolean;
  isManagement: boolean;
  homeBranch: BranchSelection;
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

      {canSetLimits && <LimitsPanel settings={settings} today={today} isManagement={isManagement} homeBranch={homeBranch} pending={pending} run={run} />}
    </div>
  );
}

function TodayRow({ b, late, lateText, pending, run }: { b: BookingItem; late: boolean; lateText: string; pending: boolean; run: Run }) {
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
        {late && (
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
      </div>
    </li>
  );
}

function LimitsPanel({
  settings,
  today,
  isManagement,
  homeBranch,
  pending,
  run,
}: {
  settings: DaySettings;
  today: string;
  isManagement: boolean;
  homeBranch: BranchSelection;
  pending: boolean;
  run: Run;
}) {
  const editable = (b: Branch) => isManagement || homeBranch === b;
  const myBranches = BRANCHES.filter((b) => editable(b.value));
  const [defaults, setDefaults] = useState(settings.defaults);
  const [dayBranch, setDayBranch] = useState<Branch>(myBranches[0]?.value ?? "kapar");
  const [daySession, setDaySession] = useState<Session>("am");
  const [dayDate, setDayDate] = useState("");
  const [dayLimit, setDayLimit] = useState("");
  const [closedBranch, setClosedBranch] = useState<string>(isManagement ? "all" : (myBranches[0]?.value ?? "kapar"));
  const [closedDate, setClosedDate] = useState("");
  const [closedNote, setClosedNote] = useState("");

  const input = "rounded-lg border border-neutral-300 px-3 py-2 text-sm";
  const btn = "rounded-lg bg-neutral-900 text-white px-3 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <section className="space-y-6 rounded-xl border border-neutral-200 bg-white p-4 md:p-6">
      <h2 className="text-lg font-semibold">Limits &amp; closed days</h2>

      <div className="space-y-2">
        <h3 className="font-medium">Normal limit per session</h3>
        <div className="space-y-2">
          {BRANCHES.map(({ value, label }) => (
            <div key={value} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-24 font-medium">{label}</span>
              {SESSIONS.map((s) => (
                <label key={s.value} className="flex items-center gap-2">
                  <span className="text-neutral-500">{s.value.toUpperCase()}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!editable(value) || pending}
                    value={defaults[value][s.value]}
                    onChange={(e) => setDefaults((d) => ({ ...d, [value]: { ...d[value], [s.value]: Number(e.target.value) } }))}
                    className={`${input} w-20`}
                  />
                  {editable(value) && defaults[value][s.value] !== settings.defaults[value][s.value] && (
                    <button disabled={pending} className={btn} onClick={() => run(() => setDefaultLimitAction(value, s.value, defaults[value][s.value]))}>
                      Save
                    </button>
                  )}
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Different limit for one day</h3>
        <p className="text-sm text-neutral-500">For example a lower limit when a mechanic is on leave.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={dayBranch} onChange={(e) => setDayBranch(e.target.value as Branch)} className={input}>
            {myBranches.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <input type="date" min={today} value={dayDate} onChange={(e) => setDayDate(e.target.value)} className={input} />
          <select value={daySession} onChange={(e) => setDaySession(e.target.value as Session)} className={input}>
            {SESSIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input type="number" min={0} max={100} placeholder="Limit" value={dayLimit} onChange={(e) => setDayLimit(e.target.value)} className={`${input} w-24`} />
          <button
            disabled={pending || !dayDate || dayLimit === ""}
            className={btn}
            onClick={() =>
              run(async () => {
                const r = await setDayLimitAction(dayBranch, dayDate, daySession, Number(dayLimit));
                if (!r.error) {
                  setDayDate("");
                  setDayLimit("");
                }
                return r;
              })
            }
          >
            Save
          </button>
        </div>
        {settings.overrides.length > 0 && (
          <ul className="text-sm space-y-1">
            {settings.overrides.map((o) => (
              <li key={`${o.branch}-${o.date}-${o.session}`} className="flex items-center gap-3">
                <span>
                  {branchLabel(o.branch)}, {dayLabel(o.date, today)}, {o.session.toUpperCase()}: limit {o.limit}
                </span>
                {editable(o.branch) && (
                  <button disabled={pending} className="text-red-600 underline" onClick={() => run(() => setDayLimitAction(o.branch, o.date, o.session, null))}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Closed days</h3>
        <p className="text-sm text-neutral-500">Customers can&apos;t book these days. Bookings already made stay, so call those customers.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={closedBranch} onChange={(e) => setClosedBranch(e.target.value)} className={input}>
            {isManagement && <option value="all">All branches</option>}
            {myBranches.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <input type="date" min={today} value={closedDate} onChange={(e) => setClosedDate(e.target.value)} className={input} />
          <input placeholder="Reason (e.g. Deepavali)" value={closedNote} onChange={(e) => setClosedNote(e.target.value)} className={`${input} w-56`} />
          <button
            disabled={pending || !closedDate}
            className={`${btn} inline-flex items-center gap-1`}
            onClick={() =>
              run(async () => {
                const r = await addClosedDayAction(closedBranch === "all" ? null : (closedBranch as Branch), closedDate, closedNote);
                if (!r.error) {
                  setClosedDate("");
                  setClosedNote("");
                }
                return r;
              })
            }
          >
            <Lock className="w-4 h-4" /> Close day
          </button>
        </div>
        {settings.closed.length > 0 && (
          <ul className="text-sm space-y-1">
            {settings.closed.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <span>
                  {dayLabel(c.date, today)} · {c.branch ? branchLabel(c.branch) : "All branches"}
                  {c.note ? ` · ${c.note}` : ""}
                </span>
                {(isManagement || (c.branch !== null && editable(c.branch))) && (
                  <button disabled={pending} className="inline-flex items-center gap-1 text-emerald-700 underline" onClick={() => run(() => removeClosedDayAction(c.id))}>
                    <Unlock className="w-3 h-3" /> Reopen
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
