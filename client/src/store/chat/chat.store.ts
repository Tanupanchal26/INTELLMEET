import { create } from 'zustand';

export type DeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Reaction { emoji: string; users: string[] }

export interface ChannelMessage {
  _id: string;
  content: string;
  sender: { _id: string; name: string; avatar?: string };
  type: 'text' | 'file' | 'system' | 'announcement';
  reactions: Reaction[];
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  delivery?: DeliveryState;
  readBy?: string[];
}

/** Legacy in-meeting chat message shape */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  type?: 'text' | 'system';
}

interface ChatState {
  // ── Meeting chat ────────────────────────────────────────────────────────────
  messages:    ChatMessage[];
  typingUsers: string[];
  addMessage:  (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setTyping:   (name: string, isTyping: boolean) => void;
  clearChat:   () => void;

  // ── Channel chat ────────────────────────────────────────────────────────────
  // channelId → messages
  channelMessages: Record<string, ChannelMessage[]>;
  // channelId → Set of typing user names
  channelTyping:   Record<string, string[]>;
  // channelId → last read messageId per viewer (userId → msgId)
  readReceipts:    Record<string, Record<string, string>>;
  // unread counts per channel
  unreadCounts:    Record<string, number>;

  initChannel:         (channelId: string, msgs: ChannelMessage[]) => void;
  appendChannelMsg:    (channelId: string, msg: ChannelMessage) => void;
  updateMsgDelivery:   (channelId: string, msgId: string, state: DeliveryState) => void;
  updateMsgReactions:  (channelId: string, msgId: string, reactions: Reaction[]) => void;
  setMessageDeleted:   (channelId: string, msgId: string) => void;
  setMessageEdited:    (channelId: string, msg: ChannelMessage) => void;
  setChannelTyping:    (channelId: string, userId: string, name: string, isTyping: boolean) => void;
  markChannelRead:     (channelId: string, userId: string, messageId: string) => void;
  incrementUnread:     (channelId: string) => void;
  clearUnread:         (channelId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // ── Meeting chat defaults ───────────────────────────────────────────────────
  messages:    [],
  typingUsers: [],
  addMessage:  (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setTyping:   (name, isTyping) => set((s) => ({
    typingUsers: isTyping
      ? [...new Set([...s.typingUsers, name])]
      : s.typingUsers.filter((u) => u !== name),
  })),
  clearChat: () => set({ messages: [], typingUsers: [] }),

  // ── Channel chat defaults ───────────────────────────────────────────────────
  channelMessages: {},
  channelTyping:   {},
  readReceipts:    {},
  unreadCounts:    {},

  initChannel: (channelId, msgs) =>
    set((s) => ({
      channelMessages: { ...s.channelMessages, [channelId]: msgs },
      channelTyping:   { ...s.channelTyping,   [channelId]: [] },
    })),

  appendChannelMsg: (channelId, msg) =>
    set((s) => ({
      channelMessages: {
        ...s.channelMessages,
        [channelId]: [...(s.channelMessages[channelId] ?? []), msg],
      },
    })),

  updateMsgDelivery: (channelId, msgId, state) =>
    set((s) => ({
      channelMessages: {
        ...s.channelMessages,
        [channelId]: (s.channelMessages[channelId] ?? []).map((m) =>
          m._id === msgId ? { ...m, delivery: state } : m
        ),
      },
    })),

  updateMsgReactions: (channelId, msgId, reactions) =>
    set((s) => ({
      channelMessages: {
        ...s.channelMessages,
        [channelId]: (s.channelMessages[channelId] ?? []).map((m) =>
          m._id === msgId ? { ...m, reactions } : m
        ),
      },
    })),

  setMessageDeleted: (channelId, msgId) =>
    set((s) => ({
      channelMessages: {
        ...s.channelMessages,
        [channelId]: (s.channelMessages[channelId] ?? []).map((m) =>
          m._id === msgId ? { ...m, isDeleted: true, content: '[Message deleted]' } : m
        ),
      },
    })),

  setMessageEdited: (channelId, msg) =>
    set((s) => ({
      channelMessages: {
        ...s.channelMessages,
        [channelId]: (s.channelMessages[channelId] ?? []).map((m) =>
          m._id === msg._id ? msg : m
        ),
      },
    })),

  setChannelTyping: (channelId, _userId, name, isTyping) =>
    set((s) => {
      const prev = s.channelTyping[channelId] ?? [];
      return {
        channelTyping: {
          ...s.channelTyping,
          [channelId]: isTyping
            ? [...new Set([...prev, name])]
            : prev.filter((n) => n !== name),
        },
      };
    }),

  markChannelRead: (channelId, userId, messageId) =>
    set((s) => ({
      readReceipts: {
        ...s.readReceipts,
        [channelId]: { ...(s.readReceipts[channelId] ?? {}), [userId]: messageId },
      },
    })),

  incrementUnread: (channelId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [channelId]: (s.unreadCounts[channelId] ?? 0) + 1,
      },
    })),

  clearUnread: (channelId) =>
    set((s) => ({
      unreadCounts: { ...s.unreadCounts, [channelId]: 0 },
    })),
}));
