import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import type { MechanicCommitmentRow } from "@/lib/mechanic-commitment-actions";
import type { Branch, BranchSelection } from "@/lib/branch";
import AllBranchesMechanicPerformanceClient from "./AllBranchesMechanicPerformanceClient";

export default function AllBranchesMechanicPerformanceTable({
  rows,
  branchSelection,
  locked,
  prevRevenueByMechanicId,
  commitmentByMechanicId,
  dailyTarget,
  targetByBranch,
  weekAchievedByBranch,
  selectedDate,
  isToday,
}: {
  rows: MechanicPerformanceRowWithBranch[];
  branchSelection?: BranchSelection;
  locked?: boolean;
  prevRevenueByMechanicId: Record<string, number>;
  commitmentByMechanicId: Record<string, MechanicCommitmentRow>;
  dailyTarget: number;
  targetByBranch: Record<Branch, number>;
  weekAchievedByBranch: Record<Branch, number>;
  selectedDate?: string;
  isToday?: boolean;
}) {
  return (
    <AllBranchesMechanicPerformanceClient
      rows={rows}
      branchSelection={branchSelection}
      locked={locked}
      prevRevenueByMechanicId={prevRevenueByMechanicId}
      commitmentByMechanicId={commitmentByMechanicId}
      dailyTarget={dailyTarget}
      targetByBranch={targetByBranch}
      weekAchievedByBranch={weekAchievedByBranch}
      selectedDate={selectedDate}
      isToday={isToday}
    />
  );
}
