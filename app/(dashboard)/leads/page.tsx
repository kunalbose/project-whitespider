'use client';

import styles from './page.module.css';
import LeadsSidebar from '@/components/leads/LeadsSidebar';
import MainContent from '@/components/leads/MainContent';
import UploadView from '@/components/leads/UploadView';
import { useListStore } from '@/stores/listStore';

export default function Leads() {

  const { activeListId, setActiveList } = useListStore();

  function handleCreateList() {
    setActiveList(null);
  }

  return (
    <div className="flex h-[calc(100vh-57px)] border-orange-700">
      <div className="w-1/3 bg-black border-r border-gray-700 text-white">
        <LeadsSidebar/>
      </div>

      <div className="flex-1 flex flex-col bg-[#0f0f0f] text-white">
        <div className="flex justify-end p-4 border-b border-gray-800">
          <button
            onClick={handleCreateList}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 
                       hover:from-purple-500 hover:to-blue-500 
                       focus:ring-2 focus:ring-purple-400
                       transition duration-200 shadow-md cursor-pointer"
          >
            + Create List
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {activeListId ? <MainContent /> : <UploadView />}
        </div>
      </div>

    </div>
  );
}
