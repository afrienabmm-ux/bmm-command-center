// Deliberately hardcoded to these two specific people, not a role check —
// Administrator (or any other role) doesn't grant access to the Logs page.
export const LOGS_VIEWER_EMAILS = ["jasonng1494@gmail.com", "afrienabmm@gmail.com"];

export function canViewLogs(email: string | null | undefined): boolean {
  return !!email && LOGS_VIEWER_EMAILS.includes(email);
}
