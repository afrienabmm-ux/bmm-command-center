import { requirePage, getActiveBranchSelection } from "@/lib/current-user";
import { getMechanics, getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MechanicsClient from "./MechanicsClient";

export const dynamic = "force-dynamic";

export default async function MechanicsPage() {
  const user = await requirePage("mechanics");
  const selection = await getActiveBranchSelection(user);
  // Every branch's roster too, so a mechanic who moved can show where to.
  const allMechanics = await getAllMechanics();
  const mechanics = selection === "all" ? allMechanics : await getMechanics(selection);
  const onTeam = mechanics.filter((m) => m.status !== "Resigned").length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mechanics"
        subtitle={
          selection === "all" ? `All branches — ${onTeam} on the team` : `${branchLabel(selection)} — ${onTeam} on the team`
        }
      />
      <div className="p-4 md:p-8">
        <MechanicsClient mechanics={mechanics} allMechanics={allMechanics} activeBranch={selection} />
      </div>
    </div>
  );
}
