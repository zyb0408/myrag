import { getToken } from './api';
import type { Reference } from '../types';

export interface SSEChunk {
  content: string;
  done: boolean;
  error?: string;
  references?: Reference[];
  // RAGFlow 新版本在最终分块提供 final_content（完整答案），
  // 增量 delta.content 可能为空。
  finalContent?: string;
}

export function streamChat(
  convId: string,
  content: string,
  onChunk: (chunk: SSEChunk) => void
): AbortController {
  const controller = new AbortController();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  fetch(`/api/chat/${convId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Request failed' }));
        onChunk({ content: '', done: true, error: err.message });
        return;
      }

      if (!response.body) {
        onChunk({ content: '', done: true, error: 'No response body' });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();

          if (data === '[DONE]') {
            onChunk({ content: '', done: true });
            return;
          }

          if (data.startsWith('{"error"')) {
            try {
              const parsed = JSON.parse(data);
              onChunk({ content: '', done: true, error: parsed.error });
            } catch {
              onChunk({ content: '', done: true, error: 'Unknown error' });
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed.references)) {
              onChunk({ content: '', done: false, references: parsed.references });
              continue;
            }
            // BFF 后端在流结束后会再发送一个 final_content 事件，
            // 作为 RAGFlow 新版本 delta.content 为空时的兜底答案。
            if (typeof parsed.final_content === 'string') {
              onChunk({ content: '', done: false, finalContent: parsed.final_content });
              continue;
            }
            const choice = parsed.choices?.[0];
            const delta = choice?.delta ?? {};
            const text = delta?.content;
            if (text != null && text !== '') {
              onChunk({ content: text, done: false });
            }
            // RAGFlow 新版本可能把 final_content 放在 delta 中，
            // 这里兜底提取，保证即使没有 BFF 包装事件也能展示完整答案。
            const deltaFinal = delta?.final_content;
            if (typeof deltaFinal === 'string' && deltaFinal.length > 0) {
              onChunk({ content: '', done: false, finalContent: deltaFinal });
            }
          } catch (e) {
            console.warn('[SSE] Failed to parse chunk:', data, e);
          }
        }
      }

      onChunk({ content: '', done: true });
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('[SSE] Stream error:', err);
        onChunk({ content: '', done: true, error: err.message });
      }
    });

  return controller;
}