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
