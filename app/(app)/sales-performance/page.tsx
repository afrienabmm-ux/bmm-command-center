import { requirePage, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getAllBranchesPerformance, getBranchPerformance, type MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import { getPackageSalesBreakdown } from "@/lib/dashboard-breakdowns-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";
import AllBranchesMechanicPerformanceTable from "../AllBranchesMechanicPerformanceTable";
import PackageBreakdownCharts from "../PackageBreakdownCharts";

export const dynamic = "force-dynamic";

export default async function SalesPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requirePage("sales-performance");
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const branchSelection = await getActiveBranchSelection(user);
  const locked = !canViewAllBranches(user);
  const onlyBranch = branchSelection === "all" ? undefined : branchSelection;

  const [rows, packageBreakdown] = await Promise.all([
    onlyBranch
      ? getBranchPerformance(onlyBranch, year, month).then(
          (r): MechanicPerformanceRowWithBranch[] => r.map((row) => ({ ...row, branch: onlyBranch }))
        )
      : getAllBranchesPerformance(year, month),
    getPackageSalesBreakdown(year, month),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Sales Performance"
        subtitle={onlyBranch ? `Every mechanic's revenue and packages — ${branchLabel(onlyBranch)}` : "Every mechanic's revenue and packages, all branches"}
        action={<MonthPicker year={year} month={month} basePath="/sales-performance" />}
      />
      <div className="p-8 space-y-8">
        <AllBranchesMechanicPerformanceTable rows={rows} branchSelection={branchSelection} locked={locked} />
        <PackageBreakdownCharts packageBreakdown={packageBreakdown} onlyBranch={onlyBranch} />
      </div>
    </div>
  );
}
