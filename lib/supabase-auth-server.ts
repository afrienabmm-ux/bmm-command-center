import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { REMEMBER_ME_MAX_AGE } from "./auth-cookie";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

// Cookie-aware Supabase client for Server Components / Server Actions.
// Uses the anon key + the visitor's own session — respects RLS, unlike
// the service-role admin client in supabase-server.ts.
//
// `rememberMe` only matters at sign-in, when Supabase actually issues new
// session cookies — it stretches their lifetime to 30 days instead of the
// plain session-cookie default (gone as soon as the browser fully closes).
// No password is ever stored anywhere for this; it's purely how long the
// existing session cookie is allowed to stick around.
export async function createAuthClient(rememberMe?: boolean) {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            const finalOptions = rememberMe ? { ...options, maxAge: REMEMBER_ME_MAX_AGE } : options;
            cookieStore.set(name, value, finalOptions);
          });
        } catch {
          // Called from a Server Component render, where cookies can't be
          // written. Middleware refreshes the session on every request, so
          // this is safe to ignore.
        }
      },
    },
  });
}
