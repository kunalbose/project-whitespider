

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";

import { calculateBounceRateStats } from "@/lib/queries/calculateFilteredStsts";    
import { filterStatsByDateRange, filterStatsByMonth } from "@/lib/queries/filterStats";
import { useDashboardStore } from "@/stores/dashboardStore";

const COLORS = ["#EF4444", "#10B981"]; 

export default function BounceRatePieChart({ stats }) {
  const { selectedBounceRateMonth ,dateRange} = useDashboardStore();
  const monthStats = filterStatsByMonth(stats, selectedBounceRateMonth);
  const dailyStats = filterStatsByDateRange(stats,dateRange);
 const {bounced, delivered} = calculateBounceRateStats(monthStats);

  const data = [
    { name: "Bounced", value: bounced },
    { name: "Delivered", value: delivered },
  ];

  return (
    <div className="relative w-full h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={50}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value}%`} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
        {bounced}%
      </div>
    </div>
  );
}
