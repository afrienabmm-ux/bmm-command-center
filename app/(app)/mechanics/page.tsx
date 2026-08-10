import { requirePage, getActiveBranchSelection } from "@/lib/current-user";
import { getMechanics, getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MechanicsClient from "./MechanicsClient";

export const dynamic = "force-dynamic";

export default async function MechanicsPage() {
  const user = await requirePage("mechanics");
  const selection = await getActiveBranchSelection(user);
  const mechanics = selection === "all" ? await getAllMechanics() : await getMechanics(selection);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mechanics"
        subtitle={
          selection === "all"
            ? `All branches — ${mechanics.length} on the team`
            : `${branchLabel(selection)} — ${mechanics.length} on the team`
        }
      />
      <div className="p-8">
        <MechanicsClient mechanics={mechanics} activeBranch={selection} />
      </div>
    </div>
  );
}
