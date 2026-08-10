import { ShieldCheck, Wrench, Users, PackageX, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { requireApproved, getActiveBranchSelection, canViewAllBranches } from "@/lib/current-user";
import { getBranchMonthSummary } from "@/lib/reports-actions";
import { getActiveRepairJobs } from "@/lib/repairs-actions";
import { getWarrantyClaims } from "@/lib/claims-actions";
import { getMechanics } from "@/lib/mechanics-actions";
import { getLowStockProducts } from "@/lib/catalog-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import CommandCenterClient from "./CommandCenterClient";
import AllBranchesOverview from "./AllBranchesOverview";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireApproved();
  const selection = await getActiveBranchSelection(user);
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  if (selection === "all") {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Command Center" subtitle="All branches — after-sales overview" />
        <div className="p-8">
          <AllBranchesOverview year={year} month={month} />
        </div>
      </div>
    );
  }

  const branch = selection;

  const [summary, claims, repairs, mechanics, lowStock] = await Promise.all([
    getBranchMonthSummary(branch, year, month),
    getWarrantyClaims(branch),
    getActiveRepairJobs(branch),
    getMechanics(branch),
    getLowStockProducts(branch),
  ]);

  const openClaims = claims.filter((c) => c.status !== "Completed" && c.status !== "Rejected").length;
  const activeMechanics = mechanics.filter((m) => m.status === "Active").length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Command Center" subtitle={`${branchLabel(branch)} — after-sales overview`} />
      <div className="p-8 space-y-8">
        <CommandCenterClient summary={summary} isAdmin={canViewAllBranches(user)} branch={branch} />

        {lowStock.length > 0 && (
          <Link
            href="/catalog"
            className="block bg-red-50 border border-red-200 rounded-xl p-5 hover:border-red-300 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={17} className="text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-700">
                  {lowStock.length} item{lowStock.length === 1 ? "" : "s"} running low — restock needed
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {lowStock
                    .slice(0, 6)
                    .map((i) => `${i.productName} (${i.quantity})`)
                    .join(", ")}
                  {lowStock.length > 6 ? `, +${lowStock.length - 6} more` : ""}
                </p>
              </div>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={ShieldCheck}
            label="Open Warranty Claims"
            value={openClaims}
            color="text-amber-700 bg-amber-500/10"
            href="/warranty-claims"
          />
          <StatCard
            icon={Wrench}
            label="Active Repair Jobs"
            value={repairs.length}
            color="text-indigo-600 bg-indigo-500/10"
            href="/repairs"
          />
          <StatCard
            icon={Users}
            label="Active Mechanics"
            value={activeMechanics}
            color="text-emerald-700 bg-emerald-500/10"
            href="/mechanics"
          />
          <StatCard
            icon={PackageX}
            label="Low Stock Items"
            value={lowStock.length}
            color="text-red-700 bg-red-500/10"
            href="/catalog"
          />
        </div>
      </div>
    </div>
  );
}
