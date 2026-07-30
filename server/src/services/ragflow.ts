import { config } from '../config.js';
import type { KnowledgeBase, ChatAssistant } from '../types/index.js';

class RAGFlowService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.ragflow.baseUrl.replace(/\/$/, '');
    this.apiKey = config.ragflow.apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.message || data?.msg || res.statusText;
      throw new Error(`RAGFlow API error: ${msg} (${res.status})`);
    }

    return data as T;
  }

  async getKnowledgeBases(): Promise<KnowledgeBase[]> {
    const resp = await this.request<{ code: number; data: KnowledgeBase[] }>(
      '/api/v1/datasets?page=1&page_size=100'
    );
    if (resp.code !== 0) throw new Error('Failed to fetch knowledge bases');
    return resp.data;
  }

  async getChatAssistants(): Promise<ChatAssistant[]> {
    const resp = await this.request<{ code: number; data: ChatAssistant[] }>(
      '/api/v1/chats'
    );
    if (resp.code !== 0) throw new Error('Failed to fetch chat assistants');
    return resp.data;
  }

  async getChatAssistant(id: string): Promise<ChatAssistant> {
    const resp = await this.request<{ code: number; data: ChatAssistant }>(
      `/api/v1/chats/${id}`
    );
    if (resp.code !== 0) throw new Error('Failed to fetch chat assistant');
    return resp.data;
  }

  async chatCompletion(
    assistantId: string,
    messages: Array<{ role: string; content: string }>,
    stream: boolean = true
  ): Promise<Response> {
    const url = `${this.baseUrl}/api/v1/openai/${assistantId}/chat/completions`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'model',
        messages,
        stream,
      }),
    });
  }
}

export const ragflowService = new RAGFlowService();
