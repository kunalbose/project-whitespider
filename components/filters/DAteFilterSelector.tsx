"use client";

import { useState } from "react";
import { DateRangePicker } from "react-date-range";
import { useDashboardStore } from "@/stores/dashboardStore";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

export default function DateFilter() {
  const { setDateRange } = useDashboardStore();

  const [range, setRange] = useState<any>([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  const [showPicker, setShowPicker] = useState(false);

  const handleRangeChange = (ranges: any) => {
    const selection = ranges.selection;
    setRange([selection]);
    setDateRange({
      startDate: selection.startDate,
      endDate: selection.endDate,
    });
    setShowPicker(false); 
  };

  return (
    <div className="relative inline-block">
      <button
        className="px-4 py-2 border rounded-md bg-white shadow-sm"
        onClick={() => setShowPicker(!showPicker)}
      > 
        {range[0].startDate.toDateString()} - {range[0].endDate.toDateString()}
      </button>

      {showPicker && (
        <div className="absolute z-50 mt-2">
          <DateRangePicker
            editableDateInputs={true}
            onChange={handleRangeChange}
            moveRangeOnFirstSelection={false}
            ranges={range}
            rangeColors={["#6366f1"]}
          />
        </div>
      )}
    </div>
  );
}
