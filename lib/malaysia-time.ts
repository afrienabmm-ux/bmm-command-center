// The server process's own clock can be in any timezone — Vercel's
// serverless functions default to UTC, a dev machine might be set to
// Asia/Kuala_Lumpur — so any code that needs "today" as the business in
// Malaysia experiences it must go through this, never `new Date()` +
// `.toISOString().slice(0, 10)` directly. That pattern reads the UTC
// calendar date, which is a day behind Malaysia for the first 8 hours of
// every Malaysia day (00:00–08:00 MYT), silently misdating anything saved
// or filtered as "today" during that window.
const MY_TZ = "Asia/Kuala_Lumpur";

export function todayInMalaysia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Both sides are reduced to a plain calendar date first, so the answer is
// whole days as a person would count them on a wall calendar — never a
// fraction, and never shifted by the server's own clock.
//
// The tempting shorthand, `(Date.now() - new Date(startedDate)) / 86400000`,
// is wrong here: a date-only string parses as UTC midnight, so between
// 00:00 and 08:00 MYT — while UTC is still on yesterday's date — it comes
// out a day short. That's the window where an overdue job would quietly
// stop looking overdue.
function calendarDayNumber(isoDate: string): number {
  const parsed = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed) ? NaN : parsed / 86400000;
}

export function daysSinceInMalaysia(fromIsoDate: string, toIsoDate?: string): number {
  const from = calendarDayNumber(fromIsoDate);
  const to = calendarDayNumber(toIsoDate ?? todayInMalaysia());
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round(to - from);
}

// A working week here runs Monday–Saturday (6 working days — the branches
// are closed Sundays), matching WORKING_DAYS_PER_WEEK in
// mechanic-commitment-actions.ts. Anchored to UTC midnight, same reasoning
// as calendarDayNumber above, so this never depends on the host's own
// timezone either.
export function startOfWeekInMalaysia(dateIso?: string): string {
  const d = new Date(`${(dateIso ?? todayInMalaysia()).slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

export function endOfWeekInMalaysia(dateIso?: string): string {
  const d = new Date(`${startOfWeekInMalaysia(dateIso)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 5); // Monday + 5 = Saturday
  return d.toISOString().slice(0, 10);
}

export const WORKING_DAYS_PER_WEEK = 6;

// Every day except Sunday counts, same definition the Dashboard's own
// revenue pace chart already uses.
export function countWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) count++;
  }
  return count;
}
