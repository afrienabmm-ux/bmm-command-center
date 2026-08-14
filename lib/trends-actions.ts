"use server";

import { requireApproved } from "./current-user";
import { supabaseAdmin } from "./supabase-server";
import { BRANCHES } from "./branch";

function monthRange(year: number, month: number): { from: string; to: string } {
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${year}-${monthStr}-01`, to: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}` };
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// Walks back from (endYear, endMonth) to build the list of months a trend
// chart covers, oldest first, correctly rolling over year boundaries.
function lastNMonths(endYear: number, endMonth: number, count: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = endYear;
  let m = endMonth;
  for (let i = 0; i < count; i++) {
    out.unshift({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export type MonthlyTrendPoint = {
  year: number;
  month: number;
  label: string;
  targetAmount: number;
  repairRevenue: number;
  packageRevenue: number;
  achievedAmount: number;
  repairJobsCompleted: number;
  warrantyClaimsSubmitted: number;
  packagesSold: number;
};

// One combined-across-branches point per month, computed with a handful of
// range queries rather than one query per branch per month — a dashboard
// trend chart doesn't need branch granularity, just the company-wide shape.
export async function getMonthlyTrends(endYear: number, endMonth: number, monthsBack = 6): Promise<MonthlyTrendPoint[]> {
  await requireApproved();
  const months = lastNMonths(endYear, endMonth, monthsBack);
  const from = monthRange(months[0].year, months[0].month).from;
  const to = monthRange(months[months.length - 1].year, months[months.length - 1].month).to;

  const [{ data: targets }, { data: jobs, error: jobsErr }, { data: claims, error: claimsErr }, { data: sales, error: salesErr }] =
    await Promise.all([
      supabaseAdmin
        .from("cc_monthly_targets")
        .select("year, month, target_amount")
        .in(
          "branch",
          BRANCHES.map((b) => b.value)
        ),
      supabaseAdmin.from("cc_repair_jobs").select("revenue_amount, completed_date").eq("status", "Completed").gte("completed_date", from).lte("completed_date", to),
      supabaseAdmin.from("cc_warranty_claims").select("submitted_date").gte("submitted_date", from).lte("submitted_date", to),
      supabaseAdmin.from("cc_package_sales").select("sale_date, cc_packages(price)").gte("sale_date", from).lte("sale_date", to),
    ]);
  if (jobsErr) throw new Error(jobsErr.message);
  if (claimsErr) throw new Error(claimsErr.message);
  if (salesErr) throw new Error(salesErr.message);

  type SaleWithPrice = { sale_date: string; cc_packages: { price: number } | null };

  return months.map(({ year, month }) => {
    const targetAmount = (targets ?? [])
      .filter((t) => t.year === year && t.month === month)
      .reduce((sum, t) => sum + Number(t.target_amount), 0);

    const monthJobs = (jobs ?? []).filter((j) => j.completed_date?.startsWith(`${year}-${String(month).padStart(2, "0")}`));
    const repairRevenue = monthJobs.reduce((sum, j) => sum + Number(j.revenue_amount), 0);

    const monthSales = ((sales ?? []) as unknown as SaleWithPrice[]).filter((s) =>
      s.sale_date?.startsWith(`${year}-${String(month).padStart(2, "0")}`)
    );
    const packageRevenue = monthSales.reduce((sum, s) => sum + Number(s.cc_packages?.price ?? 0), 0);

    const monthClaims = (claims ?? []).filter((c) => c.submitted_date?.startsWith(`${year}-${String(month).padStart(2, "0")}`));

    return {
      year,
      month,
      label: monthLabel(year, month),
      targetAmount,
      repairRevenue,
      packageRevenue,
      achievedAmount: repairRevenue + packageRevenue,
      repairJobsCompleted: monthJobs.length,
      warrantyClaimsSubmitted: monthClaims.length,
      packagesSold: monthSales.length,
    };
  });
}
