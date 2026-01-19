'use client';

import { useEffect } from 'react';
import styles from './LeadsSidebar.module.css';
import { useListStore } from '@/stores/listStore';
import { supabase } from '@/lib/supabase';
import moment from 'moment';

export default function ListSidebar() {
  const { lists, activeListId, setLists, setActiveList } = useListStore();

  useEffect(() => {
    const fetchLists = async () => {
      const { data } = await supabase
        .from('lead_lists')
        .select('*')
        .order('created_at', { ascending: false });

      setLists(data as []);
    };

    fetchLists();
  }, []);

  function selectList(listId: number) {
    setActiveList(listId);
  }

  return (
    <div className={styles.leadSidebar}>
      <div className={styles.contactList}>
        {lists && lists.length > 0 ? (
          lists.map((list) => (
            <div
              key={list.id}
              onClick={() => selectList(list.id)}
              className={`${styles.contactItem} ${activeListId === list.id ? styles.activeContact : ''}`}
            >
              <div className={styles.contactText}>
                <p className={styles.name}>{list.name || 'Unnamed List'}</p>
                <p className={styles.email}>{`${list.total_leads || 0} leads`}</p>
                <small>Created {moment(list.created_at).format('MMM D, h:mm A')}</small>
              </div>
              <div className={styles.timeDiv}>
                <span className={styles.time}>
                  {list.last_uploaded_at ? moment(list.last_uploaded_at).format('MMM D, h:mm A') : ''}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-400 text-sm">No lead lists yet</p>
            <p className="text-gray-500 text-xs mt-2">Click "Create List" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
