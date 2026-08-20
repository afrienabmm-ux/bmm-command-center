import type { MonthlyTrendPoint } from "@/lib/trends-actions";
import { BranchJobsChart } from "./TrendCharts";

export default function MonthlyTrends({ points }: { points: MonthlyTrendPoint[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900 mb-3">Trends</p>
      <BranchJobsChart points={points} />
    </div>
  );
}
