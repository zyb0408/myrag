<script setup lang="ts">
// 对应原 client/src/components/chat/MessageList.tsx
import { ref, watch, nextTick } from 'vue';
import MessageBubble from './MessageBubble.vue';
import type { Message } from '../../types';

const props = defineProps<{
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}>();

const bottomRef = ref<HTMLDivElement | null>(null);

// 对应原 useEffect：messages / streamingContent 变化时滚动到底部
watch(
  () => [props.messages, props.streamingContent],
  async () => {
    await nextTick();
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' });
  }
);
</script>

<template>
  <div class="msg-list">
    <MessageBubble
      v-for="msg in messages"
      :key="msg.id"
      :role="msg.role"
      :content="msg.content"
    />
    <MessageBubble
      v-if="isStreaming && streamingContent"
      role="assistant"
      :content="streamingContent"
      is-streaming
    />
    <div v-if="isStreaming && !streamingContent" style="text-align: center; padding: 24px">
      <div style="display: inline-flex; gap: 6px; align-items: center; color: #999; font-size: 13px">
        <span class="dot-pulse">思考中</span>
      </div>
    </div>
    <div ref="bottomRef" />
  </div>
</template>

<style scoped>
.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}
</style>
