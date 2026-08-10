import Link from "next/link";
import { requireApproved, requirePage, getActiveBranchSelection } from "@/lib/current-user";
import { getBranchMonthSummary, getMechanicAchievements, getMechanicPackageAchievements } from "@/lib/reports-actions";
import { BRANCHES, branchLabel } from "@/lib/branch";
import { formatCurrency, monthLabel } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import ReportsClient from "./ReportsClient";
import AllBranchesReportExport from "./AllBranchesReportExport";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requirePage("reports");
  const selection = await getActiveBranchSelection(user);
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  if (selection === "all") {
    const perBranch = await Promise.all(
      BRANCHES.map(async ({ value: branch }) => ({
        branch,
        summary: await getBranchMonthSummary(branch, year, month),
      }))
    );
    const totalTarget = perBranch.reduce((s, b) => s + b.summary.targetAmount, 0);
    const totalAchieved = perBranch.reduce((s, b) => s + b.summary.achievedAmount, 0);

    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Reports" subtitle="All branches — monthly performance" />
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <p className="text-xs text-neutral-500 mb-1">{monthLabel(month, year)} — Combined Target</p>
              <p className="text-xl font-semibold text-neutral-900">{formatCurrency(totalTarget)}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <p className="text-xs text-neutral-500 mb-1">Combined Achieved</p>
              <p className="text-xl font-semibold text-neutral-900">{formatCurrency(totalAchieved)}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <p className="text-xs text-neutral-500 mb-1">Progress</p>
              <p className="text-xl font-semibold text-neutral-900">
                {totalTarget > 0 ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100)) : 0}%
              </p>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-800">Target vs Achieved by Branch</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Switch to a single branch above to see individual mechanic achievement
                </p>
              </div>
              <AllBranchesReportExport year={year} month={month} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                    <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>
                    <th className="font-medium px-5 py-3 whitespace-nowrap">Target</th>
                    <th className="font-medium px-5 py-3 whitespace-nowrap">Achieved</th>
                    <th className="font-medium px-5 py-3 whitespace-nowrap">Progress</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {perBranch.map(({ branch, summary }) => {
                    const pct =
                      summary.targetAmount > 0
                        ? Math.min(100, Math.round((summary.achievedAmount / summary.targetAmount) * 100))
                        : 0;
                    return (
                      <tr key={branch} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                        <td className="px-5 py-3.5 text-neutral-900 font-medium whitespace-nowrap">{branchLabel(branch)}</td>
                        <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(summary.targetAmount)}</td>
                        <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{formatCurrency(summary.achievedAmount)}</td>
                        <td className="px-5 py-3.5 text-neutral-700 whitespace-nowrap">{pct}%</td>
                        <td className="px-5 py-3.5 text-right">
                          <Link href="/reports" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                            View detail →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const branch = selection;
  const [summary, achievements, packageAchievements] = await Promise.all([
    getBranchMonthSummary(branch, year, month),
    getMechanicAchievements(branch, year, month),
    getMechanicPackageAchievements(branch, year, month),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Reports" subtitle={`${branchLabel(branch)} — monthly performance`} />
      <div className="p-8">
        <ReportsClient
          summary={summary}
          achievements={achievements}
          packageAchievements={packageAchievements}
          branch={branch}
        />
      </div>
    </div>
  );
}
