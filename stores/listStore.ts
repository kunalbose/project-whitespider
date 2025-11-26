import { create } from 'zustand';
import { persist } from 'zustand/middleware'; 

interface List {
  id: number;
  name: string;
  created_at: string;
  total_leads?: number;
  last_uploaded_at?: string;
}

interface ListState {
  lists: List[];
  activeListId: number | null;
  setLists: (lists: List[]) => void;
  setActiveList: (id: number | null) => void;
}

export const useListStore = create<ListState>()(
    persist(
        (set) => ({
            lists: [],
            activeListId: null,
            setLists: (lists) => set({ lists }),
            setActiveList: (id) => set({ activeListId: id }),
        }),
        {
            name: 'list-store'
        }
    )
);
