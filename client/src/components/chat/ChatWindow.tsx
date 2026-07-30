import { Empty } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { useChatStore } from '../../stores/chatStore';
import { useAppStore } from '../../stores/appStore';
import { streamChat } from '../../services/sse';
import { useState, useRef, useCallback } from 'react';

export default function ChatWindow() {
  const currentConvId = useChatStore((s) => s.currentConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const messages = useChatStore((s) => s.messages);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendStreamContent = useChatStore((s) => s.appendStreamContent);
  const setIsStreaming = useChatStore((s) => s.setIsStreaming);
  const resetStreaming = useChatStore((s) => s.resetStreaming);

  const selectedAssistantName = useAppStore((s) => s.selectedAssistantName);
  const selectedKbName = useAppStore((s) => s.selectedKbName);

  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const currentConv = conversations.find((c) => c.id === currentConvId);

  const handleSend = useCallback(
    (content: string) => {
      if (!currentConvId) return;

      setSending(true);
      setIsStreaming(true);

      // Optimistic user message
      const userMsg = {
        id: `user-${Date.now()}`,
        conversation_id: currentConvId,
        role: 'user' as const,
        content,
        references: null,
        created_at: new Date().toISOString(),
      };
      addMessage(userMsg);

      const controller = streamChat(currentConvId, content, (chunk) => {
        if (chunk.error) {
          appendStreamContent(`\n\n[错误: ${chunk.error}]`);
          setIsStreaming(false);
          setSending(false);
          return;
        }

        if (chunk.done) {
          setIsStreaming(false);
          setSending(false);
          return;
        }

        appendStreamContent(chunk.content);
      });

      abortRef.current = controller;
    },
    [currentConvId]
  );

  // No conversation selected
  if (!currentConvId || !currentConv) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          background: '#fff',
        }}
      >
        <Empty
          image={<MessageOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description={
            selectedAssistantName
              ? '选择或新建一个对话开始问答'
              : '请先在左侧选择一个知识库'
          }
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <ChatHeader
        conversationName={currentConv.name}
        kbName={currentConv.kb_name || selectedKbName || ''}
      />
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
      />
      <ChatInput onSend={handleSend} disabled={isStreaming || sending} />
    </div>
  );
}
