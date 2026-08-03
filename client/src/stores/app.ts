import { defineStore } from 'pinia';
import type { KnowledgeBase, ChatAssistant } from '../types';
import { getKnowledgeBases, getChatAssistants } from '../services/api';

export const useAppStore = defineStore('app', {
  state: () => ({
    knowledgeBases: [] as KnowledgeBase[],
    chatAssistants: [] as ChatAssistant[],
    selectedAssistantId: null as string | null,
    selectedAssistantName: null as string | null,
    selectedKbName: null as string | null,
    loadingKbs: false,
    loadingAssistants: false,
  }),

  actions: {
    async fetchKnowledgeBases() {
      this.loadingKbs = true;
      try {
        this.knowledgeBases = await getKnowledgeBases();
      } catch (err) {
        console.error('Failed to load knowledge bases:', err);
      } finally {
        this.loadingKbs = false;
      }
    },

    async fetchChatAssistants() {
      this.loadingAssistants = true;
      try {
        this.chatAssistants = await getChatAssistants();
      } catch (err) {
        console.error('Failed to load chat assistants:', err);
      } finally {
        this.loadingAssistants = false;
      }
    },

    selectAssistant(id: string, name: string, kbName: string) {
      this.selectedAssistantId = id;
      this.selectedAssistantName = name;
      this.selectedKbName = kbName;
    },
  },
});
