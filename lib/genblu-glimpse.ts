import "server-only";
import { supabaseAdmin } from "./supabase-server";
import { fetchAllRows } from "./fetch-all";
import { BRANCHES, type Branch } from "./branch";
import { isNewBikeAward } from "./genblu-rules";

// Numbers for the "GenBlu this month" card on the home dashboard. Counted
// the same way as the GenBlu page: 100-point awards are new-bike awards,
// not point allocations; sign-ups split like the page's tabs.
export type GenbluGlimpse = {
  allocations: { counts: number; points: number };
  today: { counts: number; points: number };
  newBike: number;
  salesmanSignups: number;
  salesmanExisting: number;
  adminSignups: number;
  byBranch: { branch: Branch; label: string; counts: number; points: number }[];
};


function malaysiaDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

export async function getGenbluGlimpse(year: number, month: number, today: string, onlyBranch?: Branch): Promise<GenbluGlimpse> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  // Registrations are dated by when they were made (Malaysia time); a day
  // either side is fetched and trimmed below.
  const regFrom = new Date(`${prefix}-01T00:00:00Z`).getTime() - 86400_000;
  const regTo = new Date(`${nextMonth}T00:00:00Z`).getTime() + 86400_000;

  const [tx, regs] = await Promise.all([
    fetchAllRows<{ branch: Branch; points: number; transaction_date: string }>((a, b) => {
      let q = supabaseAdmin
        .from("cc_genblu_transactions")
        .select("branch, points, transaction_date")
        .gte("transaction_date", `${prefix}-01`)
        .lt("transaction_date", nextMonth);
      if (onlyBranch) q = q.eq("branch", onlyBranch);
      return q.order("id").range(a, b);
    }),
    fetchAllRows<{ branch: Branch; created_at: string; external_source_id: string | null; points_accrued: number | null }>((a, b) => {
      let q = supabaseAdmin
        .from("cc_genblu_registrations")
        .select("branch, created_at, external_source_id, points_accrued")
        .eq("source", "new_customer")
        .gte("created_at", new Date(regFrom).toISOString())
        .lt("created_at", new Date(regTo).toISOString());
      if (onlyBranch) q = q.eq("branch", onlyBranch);
      return q.order("id").range(a, b);
    }),
  ]);
  if (tx.error) throw new Error(tx.error.message);
  if (regs.error) throw new Error(regs.error.message);

  const out: GenbluGlimpse = {
    allocations: { counts: 0, points: 0 },
    today: { counts: 0, points: 0 },
    newBike: 0,
    salesmanSignups: 0,
    salesmanExisting: 0,
    adminSignups: 0,
    byBranch: BRANCHES.filter((b) => !onlyBranch || b.value === onlyBranch).map((b) => ({ branch: b.value, label: b.label, counts: 0, points: 0 })),
  };
  for (const t of tx.data) {
    const pts = Number(t.points);
    if (isNewBikeAward(pts, t.transaction_date)) {
      out.newBike += 1;
      continue;
    }
    out.allocations.counts += 1;
    out.allocations.points += pts;
    if (t.transaction_date === today) {
      out.today.counts += 1;
      out.today.points += pts;
    }
    const row = out.byBranch.find((r) => r.branch === t.branch);
    if (row) {
      row.counts += 1;
      row.points += pts;
    }
  }
  for (const r of regs.data) {
    if (!malaysiaDate(r.created_at).startsWith(prefix)) continue;
    // Every salesman sign-up is a new-bike registration, even for a customer
    // who already had points; salesmanExisting just says how many had some.
    if (!r.external_source_id) out.adminSignups += 1;
    else {
      out.salesmanSignups += 1;
      if (r.points_accrued !== null && Number(r.points_accrued) !== 0 && Number(r.points_accrued) !== 100) out.salesmanExisting += 1;
    }
  }
  return out;
}
