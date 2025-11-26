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
        {lists?.map((list) => (
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
        ))}
      </div>
    </div>
  );
}
