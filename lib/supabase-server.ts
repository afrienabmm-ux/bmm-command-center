import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. See .env.example.");
}

// Service-role client: bypasses row-level security. Only ever import this
// from server-side code (Server Actions / Server Components) — never from
// a "use client" file, or the key would end up in the browser bundle.
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
