import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/current-user";
import { todayInMalaysia } from "@/lib/malaysia-time";
import { getGenbluMonthlyReport, type GenbluReportMetric } from "@/lib/genblu-report-actions";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";

export const dynamic = "force-dynamic";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function pctColor(pct: number | undefined, target: number | undefined): string {
  if (pct === undefined) return "text-neutral-400";
  if (target !== undefined) return pct >= target ? "text-emerald-700" : "text-red-600";
  return "text-neutral-700";
}

function fmtNum(n: number | undefined): string {
  return n === undefined ? "—" : String(n);
}

function fmtPct(n: number | undefined): string {
  return n === undefined ? "—" : `${n}%`;
}

function MetricCells({ row, targets }: { row: GenbluReportMetric; targets?: { install_pct?: number; ecoupon_pct?: number } }) {
  return (
    <>
      <td className="px-5 py-2.5 text-neutral-700">{fmtNum(row.bikes_sold)}</td>
      <td className="px-5 py-2.5 text-neutral-700">{fmtNum(row.genblu_installed)}</td>
      <td className={`px-5 py-2.5 font-semibold ${pctColor(row.install_pct, targets?.install_pct)}`}>{fmtPct(row.install_pct)}</td>
      <td className="px-5 py-2.5 text-neutral-700">{fmtNum(row.ecoupon_used)}</td>
      <td className={`px-5 py-2.5 font-semibold ${pctColor(row.ecoupon_pct, targets?.ecoupon_pct)}`}>{fmtPct(row.ecoupon_pct)}</td>
    </>
  );
}

export default async function GenbluSalesRatePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requirePage("reports");
  const [todayYear, todayMonth] = todayInMalaysia().split("-").map(Number);
  const params = await searchParams;
  const year = params.year ? Number(params.year) : todayYear;
  const month = params.month ? Number(params.month) : todayMonth;
  const monthKey = `${year}-${pad(month)}`;

  const monthly = await getGenbluMonthlyReport(monthKey);
  const report = monthly?.report;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="GenBlu Registration Rate"
        subtitle="Bikes sold vs. GenBlu installed and e-coupon usage — sent monthly by the Sales Dashboard"
        action={
          <div className="flex items-center gap-3">
            <MonthPicker year={year} month={month} basePath="/reports/genblu-rate" />
            <Link href="/reports" className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-800">
              <ArrowLeft size={15} /> All Reports
            </Link>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {!report ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center text-neutral-500 text-sm">
            No report received from the Sales Dashboard for {monthKey} yet.
          </div>
        ) : (
          <>
            {report.targets && (
              <div className="flex items-center gap-4 flex-wrap">
                {report.targets.install_pct !== undefined && (
                  <span className="text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-neutral-600">
                    Install target: <span className="font-semibold text-neutral-900">{report.targets.install_pct}%</span>
                  </span>
                )}
                {report.targets.ecoupon_pct !== undefined && (
                  <span className="text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-neutral-600">
                    E-coupon target: <span className="font-semibold text-neutral-900">{report.targets.ecoupon_pct}%</span>
                  </span>
                )}
                {report.targets.points !== undefined && (
                  <span className="text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-neutral-600">
                    Points target: <span className="font-semibold text-neutral-900">{report.targets.points}</span>
                  </span>
                )}
                <span className="text-xs text-neutral-400 ml-auto">
                  Received {new Date(monthly.receivedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            )}

            {report.total && (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50">
                  <p className="text-sm font-semibold text-neutral-900">All Branches</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                      <th className="font-medium px-5 py-2.5">Bikes Sold</th>
                      <th className="font-medium px-5 py-2.5">GenBlu Installed</th>
                      <th className="font-medium px-5 py-2.5">Install %</th>
                      <th className="font-medium px-5 py-2.5">E-Coupon Used</th>
                      <th className="font-medium px-5 py-2.5">E-Coupon %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <MetricCells row={report.total} targets={report.targets} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {report.branches && report.branches.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50">
                  <p className="text-sm font-semibold text-neutral-900">By Branch</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                      <th className="font-medium px-5 py-2.5">Branch</th>
                      <th className="font-medium px-5 py-2.5">Bikes Sold</th>
                      <th className="font-medium px-5 py-2.5">GenBlu Installed</th>
                      <th className="font-medium px-5 py-2.5">Install %</th>
                      <th className="font-medium px-5 py-2.5">E-Coupon Used</th>
                      <th className="font-medium px-5 py-2.5">E-Coupon %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {report.branches.map((b, i) => (
                      <tr key={b.branch ?? b.name ?? i} className="hover:bg-neutral-50">
                        <td className="px-5 py-2.5 text-neutral-900 font-medium whitespace-nowrap">{b.branch ?? b.name ?? "—"}</td>
                        <MetricCells row={b} targets={report.targets} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {report.salespeople && report.salespeople.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50">
                  <p className="text-sm font-semibold text-neutral-900">By Salesperson</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                      <th className="font-medium px-5 py-2.5">Salesperson</th>
                      <th className="font-medium px-5 py-2.5">Branch</th>
                      <th className="font-medium px-5 py-2.5">Bikes Sold</th>
                      <th className="font-medium px-5 py-2.5">GenBlu Installed</th>
                      <th className="font-medium px-5 py-2.5">Install %</th>
                      <th className="font-medium px-5 py-2.5">E-Coupon Used</th>
                      <th className="font-medium px-5 py-2.5">E-Coupon %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {report.salespeople.map((p, i) => (
                      <tr key={`${p.name}-${i}`} className="hover:bg-neutral-50">
                        <td className="px-5 py-2.5 text-neutral-900 font-medium whitespace-nowrap">{p.name ?? "—"}</td>
                        <td className="px-5 py-2.5 text-neutral-700 whitespace-nowrap">{p.branch ?? "—"}</td>
                        <MetricCells row={p} targets={report.targets} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <details className="text-xs text-neutral-400">
              <summary className="cursor-pointer select-none hover:text-neutral-600">Raw data received</summary>
              <pre className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-4 overflow-x-auto text-neutral-600">
                {JSON.stringify(report, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
