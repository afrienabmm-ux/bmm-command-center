import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import type { MechanicCommitmentRow } from "@/lib/mechanic-commitment-actions";
import type { BranchSelection } from "@/lib/branch";
import AllBranchesMechanicPerformanceClient from "./AllBranchesMechanicPerformanceClient";

export default function AllBranchesMechanicPerformanceTable({
  rows,
  branchSelection,
  locked,
  prevRevenueByMechanicId,
  commitmentByMechanicId,
  dailyTarget,
}: {
  rows: MechanicPerformanceRowWithBranch[];
  branchSelection?: BranchSelection;
  locked?: boolean;
  prevRevenueByMechanicId: Record<string, number>;
  commitmentByMechanicId: Record<string, MechanicCommitmentRow>;
  dailyTarget: number;
}) {
  return (
    <AllBranchesMechanicPerformanceClient
      rows={rows}
      branchSelection={branchSelection}
      locked={locked}
      prevRevenueByMechanicId={prevRevenueByMechanicId}
      commitmentByMechanicId={commitmentByMechanicId}
      dailyTarget={dailyTarget}
    />
  );
}
