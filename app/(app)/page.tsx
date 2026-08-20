import { requireApproved } from "@/lib/current-user";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";
import AllBranchesOverview from "./AllBranchesOverview";

export const dynamic = "force-dynamic";

// The Command Center dashboard always shows every branch's numbers to every
// approved user, regardless of role or which branch they're otherwise locked
// to — so any branch's Admin/PIC can see who's top across the whole company.
// (Everything past this page — claims, repairs, etc. — stays branch-locked.)
export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireApproved();
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        subtitle="All branches — after-sales overview"
        action={<MonthPicker year={year} month={month} />}
      />
      <div className="p-8">
        <AllBranchesOverview year={year} month={month} isManagement={user.role === "Management"} />
      </div>
    </div>
  );
}
