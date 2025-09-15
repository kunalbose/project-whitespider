import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#4CAF50", "#FF9800"]; 

type Props = {
  aggregatedStats: {
    replyRate: number; 
  };
};

const ReplyRatePieChart = ({ rawData }: Props) => {
  const rawRate =rawData ?? 0;
  const replied = Number((rawRate ).toFixed(1)); 
  const notReplied = Number((100 - replied).toFixed(1));

  const replyRateData = [
    { name: "Replied", value: replied },
    { name: "Not Replied", value: notReplied },
  ];

  return (
    <div className="relative w-full h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={replyRateData}
            cx="50%"
            cy="50%"
            outerRadius={45}
            innerRadius={30}
            dataKey="value"
            stroke="none"
          >
            {replyRateData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value}%`} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-700">
        {replied}%
      </div>
    </div>
  );
};

export default ReplyRatePieChart;
