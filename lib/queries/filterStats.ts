import { parseISO } from "date-fns";

type Stat = {
  end_date: string; 
  start_date: string;
};

type Filters = {
  dateRange?: { startDate: Date; endDate: Date };
  monthFilter?: string;
};

export function filterStatsByDateRange(stats: Stat[], dateRange?: { startDate: Date; endDate: Date }) {

  if (!dateRange) return stats;
  const { startDate, endDate } = dateRange;

  return stats.filter(stat => {
    const endDateParsed = parseISO(stat.end_date);
    return endDateParsed >= startDate && endDateParsed <= endDate;
  });
}

export function filterStatsByMonth(stats: Stat[], month?: string) {
  if (!month) return stats;

  return stats.filter(stat => {
    const statMonth = parseISO(stat.end_date).toISOString().slice(5, 7);
    return statMonth === month;
  });
}
