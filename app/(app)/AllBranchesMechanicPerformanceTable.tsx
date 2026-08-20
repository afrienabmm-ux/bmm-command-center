import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import type { BranchSelection } from "@/lib/branch";
import AllBranchesMechanicPerformanceClient from "./AllBranchesMechanicPerformanceClient";

export default function AllBranchesMechanicPerformanceTable({
  rows,
  branchSelection,
  locked,
  daysElapsed,
}: {
  rows: MechanicPerformanceRowWithBranch[];
  branchSelection?: BranchSelection;
  locked?: boolean;
  daysElapsed: number;
}) {
  return (
    <AllBranchesMechanicPerformanceClient rows={rows} branchSelection={branchSelection} locked={locked} daysElapsed={daysElapsed} />
  );
}
