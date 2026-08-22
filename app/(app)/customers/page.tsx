import { requirePageContext, requirePage, canViewAllBranches, getActiveBranchSelection } from "@/lib/current-user";
import { getCustomers, getAllBranchesCustomers } from "@/lib/customers-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requirePage("customers");
  const { user, branch } = await requirePageContext();
  const branchSelection = await getActiveBranchSelection(user);
  const showAllBranches = branchSelection === "all";

  const customers = showAllBranches ? await getAllBranchesCustomers() : await getCustomers(branch);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Services Card"
        subtitle={`${showAllBranches ? "All Branches" : branchLabel(branch)} — ${customers.length} customers`}
      />
      <div className="p-8">
        <CustomersClient
          customers={customers}
          branch={branch}
          branchSelection={branchSelection}
          locked={!canViewAllBranches(user)}
        />
      </div>
    </div>
  );
}
