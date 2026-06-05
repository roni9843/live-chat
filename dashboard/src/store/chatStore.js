import { create } from 'zustand';

const useChatStore = create((set) => ({
  totalUnread: 0,
  setTotalUnread: (count) => set({ totalUnread: count }),
  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));

export default useChatStore;
