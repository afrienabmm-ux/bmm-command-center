"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Lock, Unlock, X } from "lucide-react";
import {
  setDefaultLimitAction,
  setDayLimitAction,
  addClosedDayAction,
  removeClosedDayAction,
  type BookingItem,
  type DaySettings,
  type Session,
} from "@/lib/booking-actions";
import { BRANCHES, branchLabel, type Branch, type BranchSelection } from "@/lib/branch";

const SESSIONS: { value: Session; label: string }[] = [
  { value: "am", label: "Morning (AM)" },
  { value: "pm", label: "Afternoon (PM)" },
];

function dayLabel(date: string, today: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const label = d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  const diff = Math.round((d.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  return diff === 0 ? `Today, ${label}` : diff === 1 ? `Tomorrow, ${label}` : label;
}

type Run = (fn: () => Promise<{ error?: string }>) => void;

export default function BookingSettingsClient({
  bookings,
  settings,
  today,
  isManagement,
  homeBranch,
}: {
  bookings: BookingItem[];
  settings: DaySettings;
  today: string;
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

  return (
    <div className="space-y-4 max-w-5xl">
      {error && <p className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}
      <LimitsPanel bookings={bookings} settings={settings} today={today} isManagement={isManagement} homeBranch={homeBranch} pending={pending} run={run} />
    </div>
  );
}

function LimitsPanel({
  bookings,
  settings,
  today,
  isManagement,
  homeBranch,
  pending,
  run,
}: {
  bookings: BookingItem[];
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

      <ClosedDaysCalendar
        bookings={bookings}
        settings={settings}
        today={today}
        isManagement={isManagement}
        myBranches={myBranches.map((b) => b.value)}
        pending={pending}
        run={run}
      />
    </section>
  );
}

// Month calendar for closed days: pick a branch (or All branches), click a
// date to close it, click a closed date to reopen it.
function ClosedDaysCalendar({
  bookings,
  settings,
  today,
  isManagement,
  myBranches,
  pending,
  run,
}: {
  bookings: BookingItem[];
  settings: DaySettings;
  today: string;
  isManagement: boolean;
  myBranches: Branch[];
  pending: boolean;
  run: Run;
}) {
  const [branch, setBranch] = useState<string>(isManagement ? "all" : (myBranches[0] ?? "kapar"));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Monday-first grid
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
    setPicked(null);
  };

  // All-branch closures always show; a branch view also shows its own.
  const closedOn = useMemo(() => {
    const map = new Map<string, DaySettings["closed"]>();
    for (const c of settings.closed) {
      if (branch === "all" || c.branch === null || c.branch === branch) map.set(c.date, [...(map.get(c.date) ?? []), c]);
    }
    return map;
  }, [settings.closed, branch]);
  const canEdit = (c: DaySettings["closed"][number]) => isManagement || (c.branch !== null && myBranches.includes(c.branch));
  const bookedOn = (date: string) => bookings.filter((b) => b.date === date && (branch === "all" || b.branch === branch)).length;

  const pickedClosed = picked ? (closedOn.get(picked) ?? []) : [];
  const pickedBooked = picked ? bookedOn(picked) : 0;
  const thisMonth = today.slice(0, 7);
  const input = "rounded-lg border border-neutral-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Closed days</h3>
      <p className="text-sm text-neutral-500">
        Click a date to close it. Click a closed date to reopen it. Customers can&apos;t book closed days; bookings already made stay, so call those
        customers.
      </p>
      <div className="flex flex-wrap items-center gap-2 max-w-2xl">
        <select
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            setPicked(null);
          }}
          className={input}
        >
          {isManagement && <option value="all">All branches</option>}
          {BRANCHES.filter((b) => myBranches.includes(b.value)).map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => shift(-1)}
            disabled={month <= thisMonth}
            aria-label="Previous month"
            className="rounded-lg p-2 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="w-36 text-center font-semibold text-sm">
            {new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", year: "numeric" })}
          </span>
          <button onClick={() => shift(1)} aria-label="Next month" className="rounded-lg p-2 hover:bg-neutral-100">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 max-w-2xl">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-neutral-500 py-1">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const isPast = date < today;
          const closed = closedOn.get(date) ?? [];
          const allClosed = closed.some((c) => c.branch === null);
          const booked = bookedOn(date);
          const style = isPast
            ? "bg-neutral-50 text-neutral-300 border-neutral-100 cursor-not-allowed"
            : allClosed
              ? "bg-red-600 text-white border-red-600"
              : closed.length
                ? "bg-red-100 text-red-800 border-red-200"
                : "bg-white hover:bg-neutral-100 border-neutral-200";
          return (
            <button
              key={date}
              disabled={isPast || pending}
              onClick={() => {
                setPicked(date === picked ? null : date);
                setNote("");
              }}
              className={`min-h-16 rounded-lg border p-1.5 text-left text-xs flex flex-col ${style} ${
                picked === date ? "ring-2 ring-neutral-900 ring-offset-1" : ""
              } ${date === today ? "font-bold" : ""}`}
            >
              <span className="text-sm">{Number(date.slice(8))}</span>
              {closed.length > 0 && (
                <span className="leading-tight line-clamp-2">
                  {closed.map((c) => c.note || (c.branch ? branchLabel(c.branch) : "Closed")).join(", ")}
                </span>
              )}
              {!isPast && booked > 0 && <span className={`mt-auto ${allClosed ? "text-white/80" : "text-neutral-500"}`}>{booked} booked</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-600 inline-block" /> Closed, all branches
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> Closed, one branch
        </span>
      </div>

      {picked && (
        <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-4 max-w-2xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{dayLabel(picked, today)}</p>
            <button onClick={() => setPicked(null)} aria-label="Close" className="text-neutral-500 hover:text-neutral-800">
              <X className="w-4 h-4" />
            </button>
          </div>
          {pickedBooked > 0 && (
            <p className="rounded-lg bg-amber-50 text-amber-800 px-3 py-2 text-sm">
              {pickedBooked} booking{pickedBooked === 1 ? "" : "s"} already on this day{branch === "all" ? "" : ` at ${branchLabel(branch as Branch)}`}.
              If you close it, call {pickedBooked === 1 ? "this customer" : "these customers"}.
            </p>
          )}
          {pickedClosed.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                Closed · {c.branch ? branchLabel(c.branch) : "All branches"}
                {c.note ? ` · ${c.note}` : ""}
              </span>
              {canEdit(c) && (
                <button
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  onClick={() =>
                    run(async () => {
                      const r = await removeClosedDayAction(c.id);
                      if (!r.error) setPicked(null);
                      return r;
                    })
                  }
                >
                  <Unlock className="w-4 h-4" /> Reopen
                </button>
              )}
            </div>
          ))}
          {!pickedClosed.some((c) => c.branch === null || c.branch === branch) && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                placeholder="Reason (e.g. Deepavali)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${input} w-56 bg-white`}
              />
              <button
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                onClick={() =>
                  run(async () => {
                    const r = await addClosedDayAction(branch === "all" ? null : (branch as Branch), picked, note);
                    if (!r.error) setPicked(null);
                    return r;
                  })
                }
              >
                <Lock className="w-4 h-4" /> Close {branch === "all" ? "all branches" : branchLabel(branch as Branch)}
              </button>
            </div>
          )}
        </div>
      )}

      {settings.closed.length > 0 && (
        <ul className="text-sm space-y-1">
          {settings.closed.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <span>
                {dayLabel(c.date, today)} · {c.branch ? branchLabel(c.branch) : "All branches"}
                {c.note ? ` · ${c.note}` : ""}
              </span>
              {canEdit(c) && (
                <button disabled={pending} className="inline-flex items-center gap-1 text-emerald-700 underline" onClick={() => run(() => removeClosedDayAction(c.id))}>
                  <Unlock className="w-3 h-3" /> Reopen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
