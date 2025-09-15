import { create } from "zustand";

type DateRange = { startDate: Date; endDate: Date };
type DateFilterType = "last7" | "last30" | "custom";
type DashboardStore = {
  clients: any[];
  campaigns: any[];
  stats: any[];
  selectedClientID: string | null;
  selectedReplyRateMonth: string;
  selectedBounceRateMonth: string;
  selectedSendMonth: string;
  dateRange: DateRange | null;
  setClients: (c: any[]) => void;
  setCampaigns: (c: any[]) => void;
  setStats: (s: any[]) => void;
  setSelectedClientID: (id: string | null) => void;
  setSelectedReplyRateMonth: (month: string) => void;
  setSelectedBounceRateMonth: (month: string) => void;
  setSelectedSendMonth: (month: string) => void;
  setDateRange: (range: DateRange) => void;
  dateFilterType: DateFilterType;
  setDateFilterType: (type: DateFilterType) => void;
};

export const useDashboardStore = create<DashboardStore>((set) => ({
  clients: [],
  campaigns: [],
  stats: [],
  selectedClientID: null,
  selectedReplyRateMonth: new Date().toISOString().slice(5, 7),
  selectedBounceRateMonth: new Date().toISOString().slice(5, 7),
  selectedSendMonth: new Date().toISOString().slice(5, 7),
  dateRange: null,
  setClients: (clients) => set({ clients }),
  setCampaigns: (campaigns) => set({ campaigns }),
  setStats: (stats) => set({ stats }),
  setSelectedClientID: (id) => set({ selectedClientID: id }),
  setSelectedReplyRateMonth: (month) => set({ selectedReplyRateMonth: month }),
  setSelectedBounceRateMonth: (month) => set({ selectedBounceRateMonth: month }),
  setSelectedSendMonth: (month) => set({ selectedSendMonth: month }),
  setDateRange: (range) => set({ dateRange: range }),
   dateFilterType: "last7",
  setDateFilterType: (type) => set({ dateFilterType: type }),
}));
