import type { MonthlyTrendPoint } from "@/lib/trends-actions";
import { BranchJobsChart } from "./TrendCharts";

export default function MonthlyTrends({ points }: { points: MonthlyTrendPoint[] }) {
  return (
    <BranchJobsChart points={points} />
  );
}
