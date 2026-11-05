import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { GenbluReportPayload } from "@/lib/genblu-report-actions";

export const dynamic = "force-dynamic";

// Morning numbers for the Hermes reminder agent — counts only, no customer
// details. One entry per salesperson from the latest GenBlu report the Sales
// Dashboard delivered for the current month (see app/api/genblu-report-intake):
// bikes sold, GenBlu registered, and how many more registrations are needed to
// reach the install-rate target.
//
//   GET /api/morning-brief
//   Authorization: Bearer <MORNING_BRIEF_SECRET>
//
// Server-to-server only, so it checks a shared secret instead of the app's
// cookie login (same approach as the other routes under app/api).
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.MORNING_BRIEF_SECRET;
  if (!secret) return false; // Refuse every request until a key is actually configured.
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Missing or invalid Authorization header." }, { status: 401 });
  }

  // Malaysia month, computed per call.
  const now = new Date(Date.now() + 8 * 3600e3);
  const month = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("cc_genblu_reports")
    .select("report, received_at")
    .eq("month", month)
    .order("received_at", { ascending: false })
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const latest = data?.[0];
  if (!latest) return NextResponse.json({ error: `No GenBlu report received yet for ${month}.` }, { status: 404 });

  const report = latest.report as GenbluReportPayload;
  const installTarget = report.targets?.install_pct ?? 90;
  const ecouponTarget = report.targets?.ecoupon_pct ?? 50;

  const people = (report.salespeople ?? [])
    .map((p) => {
      const sold = p.bikes_sold ?? 0;
      const registered = p.genblu_installed ?? 0;
      return {
        name: p.name ?? "",
        branch: p.branch ?? "",
        bikes_sold: sold,
        registered,
        registered_pct: sold > 0 ? Math.round((registered / sold) * 100) : null,
        still_needed_for_target: Math.max(0, Math.ceil((sold * installTarget) / 100) - registered),
        ecoupon_used: p.ecoupon_used ?? 0,
        ecoupon_pct: p.ecoupon_pct ?? null,
      };
    })
    .sort((a, b) => a.branch.localeCompare(b.branch) || a.name.localeCompare(b.name));

  return NextResponse.json({
    date: today,
    month,
    report_received_at: latest.received_at,
    targets: { registered_pct: installTarget, ecoupon_pct: ecouponTarget },
    note: "Bikes sold = new Yamaha only, counted by the Sales Dashboard. Numbers are as of report_received_at.",
    people,
  });
}
