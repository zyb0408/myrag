import { create } from 'zustand';
import type { Conversation, Message } from '../types';
import { getConversations, getMessages } from '../services/api';

interface ChatState {
  // Conversations
  conversations: Conversation[];
  loadingConversations: boolean;

  // Current conversation
  currentConversationId: string | null;

  // Messages
  messages: Message[];
  loadingMessages: boolean;

  // Streaming
  streamingContent: string;
  isStreaming: boolean;

  // Actions
  fetchConversations: (kbId?: string) => Promise<void>;
  setCurrentConversation: (id: string | null) => void;
  fetchMessages: (convId: string) => Promise<void>;
  addMessage: (msg: Message) => void;
  setStreamingContent: (content: string) => void;
  appendStreamContent: (chunk: string) => void;
  setIsStreaming: (v: boolean) => void;
  resetStreaming: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  loadingConversations: false,
  currentConversationId: null,
  messages: [],
  loadingMessages: false,
  streamingContent: '',
  isStreaming: false,

  fetchConversations: async (kbId?: string) => {
    set({ loadingConversations: true });
    try {
      const convs = await getConversations(kbId);
      set({ conversations: convs });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      set({ loadingConversations: false });
    }
  },

  setCurrentConversation: (id) => {
    set({ currentConversationId: id, messages: [], streamingContent: '' });
  },

  fetchMessages: async (convId) => {
    set({ loadingMessages: true });
    try {
      const msgs = await getMessages(convId);
      set({ messages: msgs });
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      set({ loadingMessages: false });
    }
  },

  addMessage: (msg) => {
    set((state) => ({ messages: [...state.messages, msg] }));
  },

  setStreamingContent: (content) => {
    set({ streamingContent: content });
  },

  appendStreamContent: (chunk) => {
    set((state) => ({ streamingContent: state.streamingContent + chunk }));
  },

  setIsStreaming: (v) => {
    set({ isStreaming: v });
  },

  resetStreaming: () => {
    set({ streamingContent: '', isStreaming: false });
  },

  clearMessages: () => {
    set({ messages: [], streamingContent: '' });
  },
}));
