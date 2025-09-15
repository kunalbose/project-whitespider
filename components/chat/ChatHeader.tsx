import { useEffect, useState } from 'react';
import styles from './ChatHeader.module.css';
import { useInboxStore } from '@/stores/InboxStore';

export default function ChatHeader() {
  const { reply_thread, chat_id } = useInboxStore();
  const [name, setName] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [SequencerThreadId, setSequencerThreadId] = useState('');
  useEffect(() => {
    const currentLead = reply_thread.find(thread => thread.id === chat_id);
    setName(`${currentLead?.lead_campaign?.lead_id.first_name || ''} ${currentLead?.lead_campaign?.lead_id.last_name || ''}`)
    setSentiment(currentLead?.thread_sentiment)
    setSequencerThreadId(currentLead?.thread_id);
  }, [chat_id])

  function handleClick() {
    if (SequencerThreadId) {
      window.open(`https://app.pipl.ai/v2/unibox/inbox/?mail=${SequencerThreadId}`);
    }
  }

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        {/* <img src="https://i.pravatar.cc/150?img=1" className={styles.avatar} /> */}
        <span className={styles.name}>{name}</span>
        <span className={styles.sentimentBadge + ' ' + styles[sentiment?.toLowerCase().replace(/\s/g, '')]}>{sentiment}</span>
      </div>

      <div className={styles.actions}>
        <button className={styles.icon} onClick={handleClick}>📞</button>
        <button className={styles.icon}>📅</button>
        <button className={styles.icon}>⋮</button>
      </div>
    </div>
  );
}
