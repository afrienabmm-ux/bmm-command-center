import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage, getActiveBranchSelection } from "@/lib/current-user";
import { todayInMalaysia } from "@/lib/malaysia-time";
import { getGenbluReportHistoryInRange, type GenbluReportMetric, type GenbluReportPayload } from "@/lib/genblu-report-actions";
import { branchLabel, type Branch } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import GenbluRateExportButton from "./GenbluRateExportButton";
import DateRangePicker from "./DateRangePicker";
import ReloadButton from "./ReloadButton";

export const dynamic = "force-dynamic";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// The Sales Dashboard sends branch as its own plain label ("Kapar", "Setia
// Alam", "Puncak Alam") rather than our internal branch value — same
// mapping as app/api/genblu-intake's BRANCH_LABEL_MAP, just the reverse
// direction (our value -> their label) so the branch switcher at the top
// of the app can filter rows they sent.
const PARTNER_LABEL: Record<Branch, string> = {
  kapar: "kapar",
  setia_alam: "setia alam",
  puncak_alam: "puncak alam",
};

function matchesBranch(rowBranch: string | undefined, branch: Branch): boolean {
  return (rowBranch ?? "").trim().toLowerCase() === PARTNER_LABEL[branch];
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
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requirePage("reports");
  const selection = await getActiveBranchSelection(user);
  const allBranches = selection === "all";
  const today = todayInMalaysia();
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const params = await searchParams;
  // Defaults to "start of this month through today" — a real from/to pair
  // in the URL (via DateRangePicker) narrows that down to any window,
  // a single week included.
  const from = params.from ?? `${todayYear}-${pad(todayMonth)}-01`;
  const to = params.to ?? today;

  // Every delivery the Sales Dashboard sent inside that window, newest
  // first — the report shown is whichever one arrived most recently
  // within it, i.e. "as of" that date range.
  const history = await getGenbluReportHistoryInRange(from, to);
  const monthly = history[0];
  const fullReport = monthly?.report;

  // Scoped down to just the selected branch — same branch switcher every
  // other page respects. "All Branches" keeps showing everything exactly
  // as the Sales Dashboard sent it.
  const report: GenbluReportPayload | undefined = fullReport && !allBranches
    ? {
        ...fullReport,
        total: fullReport.branches?.find((b) => matchesBranch(b.branch ?? b.name, selection)) ?? fullReport.total,
        branches: fullReport.branches?.filter((b) => matchesBranch(b.branch ?? b.name, selection)),
        salespeople: fullReport.salespeople?.filter((p) => matchesBranch(p.branch, selection)),
      }
    : fullReport;
  const totalLabel = allBranches ? "All Branches" : branchLabel(selection);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="GenBlu Registration Rate"
        subtitle="Bikes sold vs. GenBlu installed and e-coupon usage — sent by the Sales Dashboard"
        action={
          <div className="flex items-center gap-3">
            <DateRangePicker from={from} to={to} />
            <ReloadButton />
            {report && <GenbluRateExportButton monthKey={`${from} to ${to}`} report={report} />}
            <Link href="/reports" className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-800">
              <ArrowLeft size={15} /> All Reports
            </Link>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {!report ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center text-neutral-500 text-sm">
            No report received from the Sales Dashboard between {from} and {to}.
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
                {monthly && (
                  <span className="text-xs text-neutral-400 ml-auto">
                    Received {new Date(monthly.receivedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                )}
              </div>
            )}

            {report.total && (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50">
                  <p className="text-sm font-semibold text-neutral-900">{totalLabel}</p>
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

            {allBranches && report.branches && report.branches.length > 0 && (
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
                      {allBranches && <th className="font-medium px-5 py-2.5">Branch</th>}
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
                        {allBranches && <td className="px-5 py-2.5 text-neutral-700 whitespace-nowrap">{p.branch ?? "—"}</td>}
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
