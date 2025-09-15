"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getMonthlySentData } from "@/lib/queries/calculateFilteredStsts";

export default function MonthlySentChart({ stats }: { stats: any[] }) {
  const data = getMonthlySentData(stats);

  return (
    <ResponsiveContainer width="50%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="sent" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
