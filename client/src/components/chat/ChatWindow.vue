<script setup lang="ts">
// 对应原 client/src/components/chat/ChatWindow.tsx
import { computed, ref } from 'vue';
import { Empty } from 'ant-design-vue';
import { MessageOutlined } from '@ant-design/icons-vue';
import ChatHeader from './ChatHeader.vue';
import MessageList from './MessageList.vue';
import ChatInput from './ChatInput.vue';
import { useChatStore } from '../../stores/chat';
import { useAppStore } from '../../stores/app';
import { streamChat } from '../../services/sse';
import { stopChat } from '../../services/api';

const chatStore = useChatStore();
const appStore = useAppStore();

// 对应原 useState(sending) / useRef(abortRef)
const sending = ref(false);
const abortRef = ref<AbortController | null>(null);

// 对应原 currentConv = conversations.find(...)
const currentConv = computed(() =>
  chatStore.conversations.find((c) => c.id === chatStore.currentConversationId)
);

const emptyDescription = computed(() =>
  appStore.selectedAssistantName ? '选择或新建一个对话开始问答' : '请先在左侧选择一个知识库'
);

// 对应原 handleSend（useCallback）
function handleSend(content: string) {
  if (!chatStore.currentConversationId) return;

  sending.value = true;
  chatStore.setIsStreaming(true);
  chatStore.setStreamReferences([]);
  chatStore.setStreamingContent('');

  // Optimistic user message
  const userMsg = {
    id: `user-${Date.now()}`,
    conversation_id: chatStore.currentConversationId,
    role: 'user' as const,
    content,
    references: null,
    created_at: new Date().toISOString(),
  };
  chatStore.addMessage(userMsg);

  const convId = chatStore.currentConversationId;

  const controller = streamChat(convId, content, (chunk) => {
    if (chunk.error) {
      chatStore.appendStreamContent(`\n\n[错误: ${chunk.error}]`);
      // Persist the errored assistant message before stopping
      finalizeAssistantMessage(convId);
      chatStore.setIsStreaming(false);
      sending.value = false;
      return;
    }

    if (chunk.references) {
      chatStore.setStreamReferences(chunk.references);
      return;
    }

    // RAGFlow 新版本：final_content 为完整答案
    if (chunk.finalContent && chunk.finalContent.length > 0) {
      // final_content 是权威的完整答案，无条件覆盖当前 streamingContent
      chatStore.setStreamingContent(chunk.finalContent);
      return;
    }

    if (chunk.done) {
      finalizeAssistantMessage(convId);
      chatStore.setIsStreaming(false);
      sending.value = false;
      return;
    }

    chatStore.appendStreamContent(chunk.content);
  });

  abortRef.value = controller;
}

// 将 streamingContent 持久化为正式的 assistant 消息
function finalizeAssistantMessage(convId: string) {
  const content = chatStore.streamingContent.trim();
  if (!content) return;

  const assistantMsg = {
    id: `assistant-${Date.now()}`,
    conversation_id: convId,
    role: 'assistant' as const,
    content,
    references: chatStore.streamingReferences.length
      ? JSON.stringify(chatStore.streamingReferences)
      : null,
    created_at: new Date().toISOString(),
  };
  chatStore.addMessage(assistantMsg);
  chatStore.resetStreaming();
}

// 停止生成：中断前端 fetch + 通知后端取消 RAGFlow 流
function handleStop() {
  abortRef.value?.abort();
  abortRef.value = null;
  if (chatStore.currentConversationId) {
    finalizeAssistantMessage(chatStore.currentConversationId);
  }
  chatStore.setIsStreaming(false);
  sending.value = false;
  if (chatStore.currentConversationId) {
    stopChat(chatStore.currentConversationId).catch(() => {});
  }
}
</script>

<template>
  <!-- 对应原 ChatWindow.tsx：无会话时显示 Empty（image 用插槽渲染 MessageOutlined） -->
  <div
    v-if="!chatStore.currentConversationId || !currentConv"
    class="chat-window chat-window--empty"
  >
    <Empty :description="emptyDescription">
      <template #image>
        <MessageOutlined style="font-size: 64px; color: #d9d9d9" />
      </template>
    </Empty>
  </div>

  <div v-else class="chat-window">
    <ChatHeader
      :conversation-name="currentConv.name"
      :kb-name="currentConv.kb_name || appStore.selectedKbName || ''"
    />
    <MessageList
      :messages="chatStore.messages"
      :streaming-content="chatStore.streamingContent"
      :streaming-references="chatStore.streamingReferences"
      :is-streaming="chatStore.isStreaming"
    />
    <ChatInput
      :on-send="handleSend"
      :on-stop="handleStop"
      :is-streaming="chatStore.isStreaming"
      :disabled="chatStore.isStreaming || sending"
    />
  </div>
</template>

<style scoped>
/* 对应原 ChatWindow.tsx 的内联样式 */
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.chat-window--empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: #fff;
}
</style>