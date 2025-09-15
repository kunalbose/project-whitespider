import styles from './ChatMessageBubble.module.css';
import moment from 'moment';

export default function ChatMessageBubble({
  type,
  text,
  time,
}: {
  type: 'incoming' | 'outgoing';
  text: string;
  time: string;
}) {
  return (
    <div className={type === 'incoming' ? styles.incomingWrapper : styles.outgoingWrapper}>
      <div className={type === 'incoming' ? styles.incoming : styles.outgoing} dangerouslySetInnerHTML={{ __html: text }}>
      </div>
      <div className={styles.time}>{moment(time).format('MMM D, YYYY [at] h:mm A')}</div>
    </div>
  );
}
