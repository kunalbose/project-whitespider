import React from "react";

export default function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white shadow-lg rounded-2xl p-5 min-h-[160px]">
      <h3 className="text-gray-700 text-lg font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}
