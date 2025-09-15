

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";


import { useDashboardStore } from "@/stores/dashboardStore";
import { filterStatsByMonth } from "@/lib/queries/filterStats";
import { calculateReplyRateStats } from "@/lib/queries/calculateFilteredStsts";


const COLORS = ["#4CAF50", "#E0E0E0"];

export default function Replyrate({ stats }) {
  const { selectedReplyRateMonth } = useDashboardStore();
  const monthStats = filterStatsByMonth(stats, selectedReplyRateMonth);
  const { replied, notReplied } = calculateReplyRateStats(monthStats);

  const data = [
    { name: "Replied", value: replied },
    { name: "Not Replied", value: notReplied },
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
        {replied}%
      </div>
    </div>
  );
}
