import styles from './ChatInputBox.module.css';
import { useEffect, useState } from 'react';
import { useInboxStore } from '@/stores/InboxStore';
import { Toaster, toast } from "sonner";

export default function ChatInputBox() {
  const [cc, setCC] = useState('');
  const [bcc, setBCC] = useState('');
  const [body, setBody] = useState('');
  const { messages } = useInboxStore();

  async function handleSendThread() {
    if(body === '' || messages[1]?.thread_id?.thread_id === null) {
      toast.error('Email Body/Thread ID Not present');
    } else {
      const subject = messages.find(message => message.type === 'reply').subject || `Re: ${messages.find(message => message.type === 'outgoing email').subject}`;
      const res = await fetch("https://automation.scalingroom.com/webhook/9273511a-2d74-471c-a31a-ce306d8aa9d9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body, subject, cc, bcc, thread_id: messages[0]?.thread_id?.thread_id }),
      });
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.fieldsWrapper}>
        <div className={styles.metaFields}>
          <input
            type="text"
            placeholder="CC"
            className={styles.metaInput}
            value={cc}
            onChange={(e) => setCC(e.target.value)}
          />
          <input
            type="text"
            placeholder="BCC"
            className={styles.metaInput}
            value={bcc}
            onChange={(e) => setBCC(e.target.value)}
          />
        </div>

        <div className={styles.note}>
          Subject will be assigned <strong>Re: original subject line</strong> automatically.
        </div>

        <div className={styles.inputWrapper}>
          <button className={styles.iconLeft}>📎</button>
          <textarea
            placeholder="Email Body"
            className={styles.input}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
          />
          <button className={styles.iconRight}>☺</button>
        </div>
      </div>

      <button className={styles.sendButton} onClick={handleSendThread}>➤</button>
      <Toaster richColors position="top-right" />
    </div>
  );
}
