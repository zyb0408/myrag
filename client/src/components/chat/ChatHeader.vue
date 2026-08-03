<script setup lang="ts">
// 对应原 client/src/components/chat/ChatHeader.tsx
defineProps<{
  conversationName: string;
  kbName: string;
}>();
</script>

<template>
  <!-- 对应原 ChatHeader.tsx 的内联样式 -->
  <div class="chat-header">
    <div>
      <div class="chat-header__name">{{ conversationName }}</div>
      <div class="chat-header__kb">知识库: {{ kbName }}</div>
    </div>
  </div>
</template>

<style scoped>
.chat-header {
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
}

.chat-header__name {
  font-size: 15px;
  font-weight: 500;
}

.chat-header__kb {
  font-size: 12px;
  color: #999;
}
</style>
