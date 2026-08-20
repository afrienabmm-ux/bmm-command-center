import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import type { BranchSelection } from "@/lib/branch";
import AllBranchesMechanicPerformanceClient from "./AllBranchesMechanicPerformanceClient";

export default function AllBranchesMechanicPerformanceTable({
  rows,
  branchSelection,
  locked,
  daysElapsed,
  prevRevenueByMechanicId,
}: {
  rows: MechanicPerformanceRowWithBranch[];
  branchSelection?: BranchSelection;
  locked?: boolean;
  daysElapsed: number;
  prevRevenueByMechanicId: Record<string, number>;
}) {
  return (
    <AllBranchesMechanicPerformanceClient
      rows={rows}
      branchSelection={branchSelection}
      locked={locked}
      daysElapsed={daysElapsed}
      prevRevenueByMechanicId={prevRevenueByMechanicId}
    />
  );
}
