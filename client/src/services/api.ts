import type { ApiResponse, KnowledgeBase, ChatAssistant, Conversation, Message } from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// Knowledge bases
export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  const resp = await request<ApiResponse<KnowledgeBase[]>>('/knowledge-bases');
  return resp.data;
}

// Chat assistants
export async function getChatAssistants(): Promise<ChatAssistant[]> {
  const resp = await request<ApiResponse<ChatAssistant[]>>('/chat-assistants');
  return resp.data;
}

// Conversations
export async function getConversations(kbId?: string): Promise<Conversation[]> {
  const params = kbId ? `?kb_id=${kbId}` : '';
  const resp = await request<ApiResponse<Conversation[]>>(`/conversations${params}`);
  return resp.data;
}

export async function createConversation(data: {
  name?: string;
  assistant_id: string;
  kb_id: string;
  kb_name: string;
}): Promise<Conversation> {
  const resp = await request<ApiResponse<Conversation>>('/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return resp.data;
}

export async function renameConversation(id: string, name: string): Promise<Conversation> {
  const resp = await request<ApiResponse<Conversation>>(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return resp.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await request(`/conversations/${id}`, { method: 'DELETE' });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const resp = await request<ApiResponse<Message[]>>(`/conversations/${conversationId}/messages`);
  return resp.data;
}
