import { create } from 'zustand';
import type { KnowledgeBase, ChatAssistant } from '../types';
import { getKnowledgeBases, getChatAssistants } from '../services/api';

interface AppState {
  // Knowledge bases (datasets)
  knowledgeBases: KnowledgeBase[];
  // Chat assistants
  chatAssistants: ChatAssistant[];
  // Selected assistant
  selectedAssistantId: string | null;
  selectedAssistantName: string | null;
  selectedKbName: string | null;
  // Loading
  loadingKbs: boolean;
  loadingAssistants: boolean;

  // Actions
  fetchKnowledgeBases: () => Promise<void>;
  fetchChatAssistants: () => Promise<void>;
  selectAssistant: (id: string, name: string, kbName: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  knowledgeBases: [],
  chatAssistants: [],
  selectedAssistantId: null,
  selectedAssistantName: null,
  selectedKbName: null,
  loadingKbs: false,
  loadingAssistants: false,

  fetchKnowledgeBases: async () => {
    set({ loadingKbs: true });
    try {
      const kbs = await getKnowledgeBases();
      set({ knowledgeBases: kbs });
    } catch (err) {
      console.error('Failed to load knowledge bases:', err);
    } finally {
      set({ loadingKbs: false });
    }
  },

  fetchChatAssistants: async () => {
    set({ loadingAssistants: true });
    try {
      const assistants = await getChatAssistants();
      set({ chatAssistants: assistants });
    } catch (err) {
      console.error('Failed to load chat assistants:', err);
    } finally {
      set({ loadingAssistants: false });
    }
  },

  selectAssistant: (id, name, kbName) => {
    set({
      selectedAssistantId: id,
      selectedAssistantName: name,
      selectedKbName: kbName,
    });
  },
}));
