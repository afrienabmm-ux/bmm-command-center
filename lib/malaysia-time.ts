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
