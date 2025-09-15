import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#EF4444", "#10B981"]; 

type Props = {
  aggregatedStats: {
    bounceCount: number;
    sentCount: number;
  };
};

const BounceAnalysisPieChart = ({ rawData }: Props) => {
   const rawRate =rawData ?? 0;
  const bounceRate = Number((rawRate ).toFixed(1));

  const deliveredCount = Math.max(100 - bounceRate, 0);


  const bounceData = [
    { name: "Bounced", value: bounceRate },
    { name: "Delivered", value: deliveredCount },
  ];

  return (
    <div className="relative w-full h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={bounceData}
            cx="50%"
            cy="50%"
            outerRadius={45}
            innerRadius={30}
            dataKey="value"
            stroke="none"
          >
            {bounceData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [`${value}`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-700">
        {bounceRate}%
      </div>
    </div>
  );
};

export default BounceAnalysisPieChart;
