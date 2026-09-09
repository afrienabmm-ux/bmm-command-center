import { requirePageContext, requirePage, canViewAllBranches, getActiveBranchSelection } from "@/lib/current-user";
import { getCustomers, getAllBranchesCustomers } from "@/lib/customers-actions";
import { branchLabel } from "@/lib/branch";
import { todayInMalaysia } from "@/lib/malaysia-time";
import PageHeader from "@/components/PageHeader";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requirePage("customers");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";

  // Defaults to the last 6 months — otherwise this page loads and renders
  // every Services Card ever issued, a cost with no ceiling as the list
  // grows month over month. The public "check my card" lookup and the
  // Reports page's own export both query full history regardless of this.
  const [todayYear, todayMonth] = todayInMalaysia().split("-").map(Number);
  const sinceDate = new Date(todayYear, todayMonth - 1 - 6, 1).toISOString().slice(0, 10);

  const customers = showAllBranches ? await getAllBranchesCustomers(sinceDate) : await getCustomers(branch, sinceDate);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Services Card"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${customers.length} cards issued in the last 6 months`}
      />
      <div className="p-8">
        <CustomersClient
          customers={customers}
          branch={branch}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
          canManageCards={user.role !== "Front Desk"}
          canAddCards
        />
      </div>
    </div>
  );
}
