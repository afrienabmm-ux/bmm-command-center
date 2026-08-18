import type { MechanicPerformanceRowWithBranch } from "@/lib/reports-actions";
import AllBranchesMechanicPerformanceClient from "./AllBranchesMechanicPerformanceClient";

export default function AllBranchesMechanicPerformanceTable({ rows }: { rows: MechanicPerformanceRowWithBranch[] }) {
  return <AllBranchesMechanicPerformanceClient rows={rows} />;
}
