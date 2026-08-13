// ===== Knowledge Base (Dataset from RAGFlow) =====
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  document_count: number;
  chunk_count: number;
  embedding_model: string;
  status: string;
  create_time: number;
  update_time: number;
}

// ===== Chat Assistant (Dialog from RAGFlow) =====
export interface ChatAssistant {
  id: string;
  name: string;
  description: string;
  dataset_ids: string[];
  kb_names: string[];
  llm_id: string;
  icon: string;
  status: string;
  create_time: number;
  update_time: number;
}

// ===== Conversation (Local) =====
export interface Conversation {
  id: string;
  name: string;
  assistant_id: string;
  kb_id: string;
  kb_name: string;
  created_at: string;
  updated_at: string;
}

// ===== Message =====
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  references: string | null;
  created_at: string;
}

// ===== Citation source (from RAGFlow, simplified by BFF) =====
export interface Reference {
  document_name: string;
  content: string;
  document_id: string;
  dataset_id: string;
}

// ===== API Response =====
export interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

// ===== User =====
export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  mustResetPassword: boolean;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}
