import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import type { Message } from '../../types';

interface Props {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}

export default function MessageList({ messages, streamingContent, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
      ))}
      {isStreaming && streamingContent && (
        <MessageBubble role="assistant" content={streamingContent} isStreaming />
      )}
      {isStreaming && !streamingContent && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
              color: '#999',
              fontSize: 13,
            }}
          >
            <span className="dot-pulse">思考中</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
