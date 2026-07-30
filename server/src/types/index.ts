export interface User {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  must_reset_password: number;
  is_active: number;
  is_admin: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  name: string;
  assistant_id: string;
  kb_id: string;
  kb_name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  references: string | null;
  created_at: string;
}

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
