import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

// Cookie-aware Supabase client for Server Components / Server Actions.
// Uses the anon key + the visitor's own session — respects RLS, unlike
// the service-role admin client in supabase-server.ts.
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render, where cookies can't be
          // written. Middleware refreshes the session on every request, so
          // this is safe to ignore.
        }
      },
    },
  });
}
