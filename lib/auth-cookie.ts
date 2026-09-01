// Shared by lib/supabase-auth-server.ts (sets it at sign-in) and
// middleware.ts (reads it on every request) — kept in its own file with no
// "server-only"/next-headers imports so middleware's Edge runtime can use
// it too.
export const REMEMBER_ME_COOKIE = "cc-remember-me";
export const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
