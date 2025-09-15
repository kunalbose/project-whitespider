import { create } from 'zustand';

type InboxStore = {
    reply_thread: any[]
    chat_id: number | null
    messages: any[]
    
    setReplyThread: (c: any[]) => void
    setChat: (c: number) => void
    setMessages: (c: any[]) => void
    
};

export const useInboxStore = create<InboxStore>((set) => ({
    reply_thread: [],
    chat_id: null,
    messages: [],
   
    setReplyThread: (reply_thread) => set({ reply_thread }),
    setChat: (chat_id) => set({ chat_id }),
    setMessages: (messages) => set({ messages }),
   
}));