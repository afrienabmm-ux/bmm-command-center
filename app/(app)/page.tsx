import { redirect } from "next/navigation";
import { requireApproved, getActiveBranchSelection, isManagementLevel } from "@/lib/current-user";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MonthPicker from "@/components/MonthPicker";
import AllBranchesOverview from "./AllBranchesOverview";

export const dynamic = "force-dynamic";

// The dashboard follows the branch switcher at the top of the page: "All"
// shows the company-wide combined view, picking a specific branch scopes
// every section down to just that branch's own numbers.
export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireApproved();
  // Mechanic is jobsheet-scanning only — sent to the phone-optimized /scan
  // page (not the desktop Jobsheet list) since that's what this role is
  // for. Front Desk only ticks Services Card stamps — sent straight there.
  // This page has no page-key gate of its own (it's every other role's
  // default landing page), so it needs its own explicit redirect instead
  // of relying on requirePage().
  if (user.role === "Mechanic") redirect("/scan");
  if (user.role === "Front Desk") redirect("/customers");
  const branchSelection = await getActiveBranchSelection(user);
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        subtitle={branchSelection === "all" ? "All branches — after-sales overview" : `${branchLabel(branchSelection)} — after-sales overview`}
        action={<MonthPicker year={year} month={month} />}
      />
      <div className="p-8">
        <AllBranchesOverview
          year={year}
          month={month}
          isManagement={isManagementLevel(user.role)}
          branchSelection={branchSelection}
        />
      </div>
    </div>
  );
}
