import { requirePageContext, requirePage } from "@/lib/current-user";
import { getMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import MechanicsClient from "./MechanicsClient";

export const dynamic = "force-dynamic";

export default async function MechanicsPage() {
  await requirePage("mechanics");
  const { branch } = await requirePageContext();
  const mechanics = await getMechanics(branch);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Mechanics" subtitle={`${branchLabel(branch)} — ${mechanics.length} on the team`} />
      <div className="p-8">
        <MechanicsClient mechanics={mechanics} branch={branch} />
      </div>
    </div>
  );
}
