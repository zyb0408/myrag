import { getToken } from './api';
import type { Reference } from '../types';

export interface SSEChunk {
  content: string;
  done: boolean;
  error?: string;
  references?: Reference[];
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

      const reader = response.body?.getReader();
      if (!reader) {
        onChunk({ content: '', done: true, error: 'No response body' });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
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
              // BFF custom event: {"references": [...]} (sent just before [DONE])
              if (Array.isArray(parsed.references)) {
                onChunk({ content: '', done: false, references: parsed.references });
                continue;
              }
              const text = parsed.choices?.[0]?.delta?.content || '';
              if (text) {
                onChunk({ content: text, done: false });
              }
            } catch {
              // skip unparseable chunks
            }
          }
        }
      }

      onChunk({ content: '', done: true });
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onChunk({ content: '', done: true, error: err.message });
      }
    });

  return controller;
}
