import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface List {
  id: number;
  name: string;
  created_at: string;
  total_leads?: number;
  leads_processed?: number;
  last_uploaded_at?: string;
  status?: string;
  filepath?: string;
  schema?: Record<string, string>;
  lead_split?: number;
  error?: string;
}

interface ListState {
  lists: List[];
  activeListId: number | null;
  setLists: (lists: List[]) => void;
  setActiveList: (id: number | null) => void;
  addList: (list: List) => void;
  updateList: (id: number, updates: Partial<List>) => void;
}

export const useListStore = create<ListState>()(
  persist(
    (set) => ({
      lists: [],
      activeListId: null,
      setLists: (lists) => set({ lists }),
      setActiveList: (id) => set({ activeListId: id }),
      addList: (list) => set((state) => ({ lists: [list, ...state.lists] })),
      updateList: (id, updates) => set((state) => ({
        lists: state.lists.map((list) =>
          list.id === id ? { ...list, ...updates } : list
        ),
      })),
    }),
    {
      name: 'list-store'
    }
  )
);
