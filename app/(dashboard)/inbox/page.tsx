'use client';

import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatInputBox from '@/components/chat/ChatInputBox';
import ChatMessageBubble from '@/components/chat/ChatMessageBubble';
import { useInboxStore } from '@/stores/InboxStore';
import { useUserStore } from '@/stores/useUserStore'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react';

export default function ChatPage() {
  const { messages } = useInboxStore();
  const { email } = useUserStore()
  const router = useRouter();

  // useEffect(() => {
  //   if (!email) {
  //     router.replace('/login');
  //   }
  // }, [email]);

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden border-orange-700">

      <div className="w-1/3 bg-black border-r border-gray-700 text-white">
        <ChatSidebar />
      </div>

      <div className="flex-1 flex flex-col bg-[#0f0f0f] text-white">
        <ChatHeader />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {messages?.length > 0 ? messages.map(m => (
              m.type.includes('reply') ? <ChatMessageBubble key={m.id} type="incoming" text={m.body} time={m.email_sent_at} />
                : <ChatMessageBubble key={m.id} type="outgoing" text={m.body} time={m.email_sent_at} />
            )) : <></>}

          </div>
        </div>

        <ChatInputBox />
      </div>
    </div>
  );
}
