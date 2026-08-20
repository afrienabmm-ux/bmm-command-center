import { requirePage } from "@/lib/current-user";
import { getAllBranchesPerformance } from "@/lib/reports-actions";
import { getPackageSalesBreakdown } from "@/lib/dashboard-breakdowns-actions";
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
  await requirePage("sales-performance");
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const [rows, packageBreakdown] = await Promise.all([
    getAllBranchesPerformance(year, month),
    getPackageSalesBreakdown(year, month),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Sales Performance"
        subtitle="Every mechanic's revenue and packages, all branches"
        action={<MonthPicker year={year} month={month} basePath="/sales-performance" />}
      />
      <div className="p-8 space-y-8">
        <AllBranchesMechanicPerformanceTable rows={rows} />
        <PackageBreakdownCharts packageBreakdown={packageBreakdown} />
      </div>
    </div>
  );
}
