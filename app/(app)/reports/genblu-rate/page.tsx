import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage, getActiveBranchSelection } from "@/lib/current-user";
import { todayInMalaysia } from "@/lib/malaysia-time";
import { getGenbluReportHistoryInRange, type GenbluReportMetric, type GenbluReportPayload } from "@/lib/genblu-report-actions";
import { branchLabel, type Branch } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";
import GenbluRateExportButton from "./GenbluRateExportButton";
import ReloadButton from "./ReloadButton";
import WeekSelector from "./WeekSelector";

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
  searchParams: Promise<{ year?: string; month?: string; week?: string }>;
}) {
  const user = await requirePage("reports");
  const selection = await getActiveBranchSelection(user);
  const allBranches = selection === "all";
  const [todayYear, todayMonth] = todayInMalaysia().split("-").map(Number);
  const params = await searchParams;
  const year = params.year ? Number(params.year) : todayYear;
  const month = params.month ? Number(params.month) : todayMonth;
  const monthKey = `${year}-${pad(month)}`;
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${pad(new Date(year, month, 0).getDate())}`;

  // Only the most recent delivery for the month matters now — earlier
  // deliveries were superseded snapshots, not separate weeks (weeks live
  // inside each delivery's own "weekly" field instead; see WeekSelector).
  const history = await getGenbluReportHistoryInRange(monthStart, monthEnd);
  const monthly = history[0];
  const fullReport = monthly?.report;
  const weeks = fullReport?.weekly ?? [];

  const selectedWeekNum = params.week ? Number(params.week) : null;
  const selectedWeek = selectedWeekNum !== null ? weeks.find((w) => w.week === selectedWeekNum) : undefined;
  // Whichever scope is currently in view — one specific week, or the
  // whole month — before the branch switcher narrows it further.
  const scopeSource = selectedWeek ?? fullReport;

  const scoped = scopeSource && !allBranches
    ? {
        total: scopeSource.branches?.find((b) => matchesBranch(b.branch ?? b.name, selection)) ?? scopeSource.total,
        branches: scopeSource.branches?.filter((b) => matchesBranch(b.branch ?? b.name, selection)),
        salespeople: scopeSource.salespeople?.filter((p) => matchesBranch(p.branch, selection)),
      }
    : scopeSource;

  const branchLabelText = allBranches ? "All Branches" : branchLabel(selection);
  const totalLabel = selectedWeek ? `${branchLabelText} — ${selectedWeek.label ?? `Week ${selectedWeek.week}`}` : branchLabelText;
  const targets = fullReport?.targets;
  // Only meaningful for the whole month — a carried-in bike, by definition,
  // never belongs to any single week.
  const carriedIn = !selectedWeek ? scoped?.total?.bikes_sold_carried_in : undefined;

  const exportPayload: GenbluReportPayload | undefined = scoped
    ? { total: scoped.total, branches: scoped.branches, salespeople: scoped.salespeople }
    : undefined;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="GenBlu Registration Rate"
        subtitle="Bikes sold vs. GenBlu installed and e-coupon usage — sent by the Sales Dashboard"
        action={
          <div className="flex items-center gap-3">
            <MonthPicker year={year} month={month} basePath="/reports/genblu-rate" />
            <WeekSelector
              weeks={weeks.filter((w): w is { week: number; label: string } => w.week !== undefined).map((w) => ({ week: w.week, label: w.label ?? `Week ${w.week}` }))}
              selectedWeek={selectedWeekNum}
            />
            <ReloadButton />
            {exportPayload && <GenbluRateExportButton monthKey={selectedWeek?.label ?? monthKey} report={exportPayload} />}
            <Link href="/reports" className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-800">
              <ArrowLeft size={15} /> All Reports
            </Link>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {!scoped ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center text-neutral-500 text-sm">
            No report received from the Sales Dashboard for {monthKey} yet.
          </div>
        ) : (
          <>
            {targets && (
              <div className="flex items-center gap-4 flex-wrap">
                {targets.install_pct !== undefined && (
                  <span className="text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-neutral-600">
                    Install target: <span className="font-semibold text-neutral-900">{targets.install_pct}%</span>
                  </span>
                )}
                {targets.ecoupon_pct !== undefined && (
                  <span className="text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-neutral-600">
                    E-coupon target: <span className="font-semibold text-neutral-900">{targets.ecoupon_pct}%</span>
                  </span>
                )}
                {(targets.ecoupon_points ?? targets.points) !== undefined && (
                  <span className="text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-neutral-600">
                    Points target: <span className="font-semibold text-neutral-900">{targets.ecoupon_points ?? targets.points}</span>
                  </span>
                )}
                {monthly && (
                  <span className="text-xs text-neutral-400 ml-auto">
                    Received {new Date(monthly.receivedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                )}
              </div>
            )}

            {!!carriedIn && (
              <p className="text-xs text-neutral-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Includes {carriedIn} bike{carriedIn === 1 ? "" : "s"} sold in an earlier month but registered this month — these aren't
                attributed to any single week below.
              </p>
            )}

            {scoped.total && (
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
                      <MetricCells row={scoped.total} targets={targets} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {allBranches && scoped.branches && scoped.branches.length > 0 && (
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
                    {scoped.branches.map((b, i) => (
                      <tr key={b.branch ?? b.name ?? i} className="hover:bg-neutral-50">
                        <td className="px-5 py-2.5 text-neutral-900 font-medium whitespace-nowrap">{b.branch ?? b.name ?? "—"}</td>
                        <MetricCells row={b} targets={targets} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {scoped.salespeople && scoped.salespeople.length > 0 && (
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
                    {scoped.salespeople.map((p, i) => (
                      <tr key={`${p.name}-${i}`} className="hover:bg-neutral-50">
                        <td className="px-5 py-2.5 text-neutral-900 font-medium whitespace-nowrap">{p.name ?? "—"}</td>
                        {allBranches && <td className="px-5 py-2.5 text-neutral-700 whitespace-nowrap">{p.branch ?? "—"}</td>}
                        <MetricCells row={p} targets={targets} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <details className="text-xs text-neutral-400">
              <summary className="cursor-pointer select-none hover:text-neutral-600">Raw data received</summary>
              <pre className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-4 overflow-x-auto text-neutral-600">
                {JSON.stringify(selectedWeek ?? fullReport, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
