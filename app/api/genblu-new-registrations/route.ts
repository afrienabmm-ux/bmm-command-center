import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { BRANCHES, type Branch } from "@/lib/branch";

export const dynamic = "force-dynamic";

// A read-only feed of GenBlu registrations for brand-new customers (no
// jobsheet on file yet), for a partner's own dashboard to pull and display
// alongside ours — see the "New Registration" tab on /genblu, which shows
// the exact same subset. Server-to-server only (no logged-in session on
// the calling side), so this checks a shared secret header instead of the
// app's normal cookie-based login.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.GENBLU_PARTNER_API_KEY;
  if (!expected) return false; // Refuse every request until a key is actually configured.
  return req.headers.get("x-api-key") === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Missing or invalid x-api-key header." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since"); // ISO date/datetime — only registrations on or after this.
  const branchParam = searchParams.get("branch");
  const branch = BRANCHES.some((b) => b.value === branchParam) ? (branchParam as Branch) : null;

  let query = supabaseAdmin
    .from("cc_genblu_registrations")
    .select("branch, customer_name, customer_plate_no, salesperson_name, points_accrued, created_at")
    .eq("source", "new_customer")
    .order("created_at", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const registrations = (data ?? []).map((r) => ({
    branch: r.branch,
    customerName: r.customer_name,
    customerPlateNo: r.customer_plate_no,
    registeredBy: r.salesperson_name,
    pointsAccrued: r.points_accrued,
    registeredAt: r.created_at,
  }));

  return NextResponse.json({ registrations });
}
