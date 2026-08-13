<script setup lang="ts">
// 对应原 client/src/pages/ChatPage.tsx
import { onMounted, watch } from 'vue';
import MainLayout from '../components/layout/MainLayout.vue';
import ChatWindow from '../components/chat/ChatWindow.vue';
import { useAppStore } from '../stores/app';
import { useChatStore } from '../stores/chat';

const appStore = useAppStore();
const chatStore = useChatStore();

// 对应原 useEffect：挂载时加载 chat assistants
onMounted(() => {
  appStore.fetchChatAssistants();
});

// 对应原 useEffect：assistant 变化时清空当前对话并加载 conversations
// 切换知识库时清空当前对话，避免「下拉已切换但顶部仍显示旧对话」的不一致
watch(
  () => appStore.selectedAssistantId,
  (id, oldId) => {
    if (id && id !== oldId) {
      chatStore.setCurrentConversation(null);
      chatStore.fetchConversations(id);
    }
  }
);
</script>

<template>
  <MainLayout>
    <ChatWindow />
  </MainLayout>
</template>
