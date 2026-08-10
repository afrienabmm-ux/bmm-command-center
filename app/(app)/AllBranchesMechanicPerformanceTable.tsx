import { getAllBranchesPerformance } from "@/lib/reports-actions";
import AllBranchesMechanicPerformanceClient from "./AllBranchesMechanicPerformanceClient";

export default async function AllBranchesMechanicPerformanceTable({ year, month }: { year: number; month: number }) {
  const rows = await getAllBranchesPerformance(year, month);
  return <AllBranchesMechanicPerformanceClient rows={rows} />;
}
