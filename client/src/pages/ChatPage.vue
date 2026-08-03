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

// 对应原 useEffect：assistant 变化时加载 conversations
watch(
  () => appStore.selectedAssistantId,
  (id) => {
    if (id) {
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
