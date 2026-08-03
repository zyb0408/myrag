import { defineStore } from 'pinia';
import type { Conversation, Message } from '../types';
import { getConversations, getMessages } from '../services/api';

export const useChatStore = defineStore('chat', {
  state: () => ({
    conversations: [] as Conversation[],
    loadingConversations: false,
    currentConversationId: null as string | null,
    messages: [] as Message[],
    loadingMessages: false,
    streamingContent: '',
    isStreaming: false,
  }),

  actions: {
    async fetchConversations(kbId?: string) {
      this.loadingConversations = true;
      try {
        this.conversations = await getConversations(kbId);
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        this.loadingConversations = false;
      }
    },

    setCurrentConversation(id: string | null) {
      this.currentConversationId = id;
      this.messages = [];
      this.streamingContent = '';
    },

    async fetchMessages(convId: string) {
      this.loadingMessages = true;
      try {
        this.messages = await getMessages(convId);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        this.loadingMessages = false;
      }
    },

    addMessage(msg: Message) {
      this.messages = [...this.messages, msg];
    },

    setStreamingContent(content: string) {
      this.streamingContent = content;
    },

    appendStreamContent(chunk: string) {
      this.streamingContent += chunk;
    },

    setIsStreaming(v: boolean) {
      this.isStreaming = v;
    },

    resetStreaming() {
      this.streamingContent = '';
      this.isStreaming = false;
    },

    clearMessages() {
      this.messages = [];
      this.streamingContent = '';
    },
  },
});
