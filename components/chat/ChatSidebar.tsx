'use client';

import { useEffect, useState } from 'react';
import styles from './ChatSidebar.module.css';
import { useInboxStore } from '@/stores/InboxStore';
import { supabase } from '@/lib/supabase';
import moment from 'moment';

export default function ChatSidebar() {
  const [activeTab, setActiveTab] = useState<'all' | 'smartlead' | 'instantly' | 'sasmail'>('all');
  const { reply_thread, chat_id, setReplyThread, setChat, setMessages } = useInboxStore();

  function getSentimentClass(sentiment: string) {
    switch (sentiment?.toLowerCase()) {
      case 'interested':
        return styles.interested;
      case 'not interested':
        return styles.notInterested;
      case 'information request':
        return styles.infoRequest;
      case 'out of office':
        return styles.outOfOffice;
      case 'needs follow-up':
        return styles.needsFollowUp;
      default:
        return '';
    }
  }

  useEffect(() => {
    const fetchInbox = async () => {
      const { data: threadData } = await supabase
      .from('threads')
      .select(`
        *,
        lead_campaign (
          *,
          lead_id (
            first_name,last_name,email
          )
        ),
        latest_message_id(
          id,
          subject,
          email_sent_at
        )
      `);
      // console.log(threadData, 'data');
      setReplyThread(threadData as []);
    }
    fetchInbox();
  }, []);

  function selectChat(chat_id: number) {
    setChat(chat_id);
  }

  useEffect(() => {
    const fetchChat = async () => {
      const { data: chatData } = await supabase
      .from('emails')
      .select('*, thread_id(thread_id)')
      .eq('thread_id', chat_id)
      .order('email_sent_at', {ascending: false});

      const latest_message_id = reply_thread.find(thread => thread.id === chat_id);
      // console.log(latest_message_id, 'latest_message_id');
      const { data: ai_data } = await supabase
      .from('ai_sdr_responses')
      .select(`*`)
      .eq('email_id', latest_message_id?.latest_message_id?.id)

      // console.log(ai_data, "ai_data");
      //setAIResponse(ai_data?.[0]?.ai_generated_response)

      // console.log(chatData, 'chatdata');
      setMessages(chatData as []);
    }

    fetchChat()
  }, [chat_id])

  return (
    <div className={styles.sidebar}>
      {/* <div className={styles.tabs}>
        {['sasmail', 'instantly', 'smartlead'].map((platform) => {
          const count = contacts.filter(c => c.platform === platform && c.unread_count > 0).length;
          return (
            <div
              key={platform}
              className={`${styles.tab} ${activeTab === platform ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(platform as any)}
            >
              {platform.toUpperCase()}
              {count > 0 && <span className={styles.badge}>{count}</span>}
            </div>
          );
        })}
      </div> */}

      {/* <input className={styles.search} placeholder="Search for user or chat" />

      <div className={styles.filterButtons}>
        <button>All</button>
        <button>Positive</button>
        <button>Negative</button>
        <button>Not Answered</button>
      </div> */}

      <div className={styles.contactList}>
        {reply_thread.map((c) => (
          <div key={c.id} onClick={() => selectChat(c.id as number)} className={`${styles.contactItem} ${getSentimentClass(c.thread_sentiment)} ${chat_id === c.id ? styles.activeContact : ''}`}>
            {/* <img src={c.avatar_url} className={styles.avatar} /> */}
            <div className={styles.contactText}>
              <p>{`${c.lead_campaign.lead_id.first_name} ${c.lead_campaign.lead_id.last_name || ''}`}</p>
              <p className={styles.email}>{`(${c.lead_campaign.lead_id.email})`}</p>
              <small>{c.latest_message_id?.subject}</small>
            </div>
            <div className={styles.timeDiv}>
              <span className={styles.time}>
                {c.latest_message_id?.email_sent_at ? moment(c.latest_message_id?.email_sent_at).format('MMM D, h:mm A') : ''}
              </span>
            </div>
            {/* {c.unread_count > 0 ? (
              <span className={styles.redDot}>{c.unread_count}</span>
            ) : (
              <span className={styles.greenDot}></span>
            )} */}
          </div>
        ))}
      </div>
    </div>
  );
}
