<script setup lang="ts">
// 对应原 client/src/components/chat/MessageBubble.tsx
// react-markdown 迁移为 markdown-it（Vue 生态等价方案）
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import { UserOutlined, RobotOutlined } from '@ant-design/icons-vue';

const props = defineProps<{
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}>();

const isUser = computed(() => props.role === 'user');

// 创建 markdown-it 实例（对应 ReactMarkdown 默认渲染行为）
const md = new MarkdownIt();

// 渲染 markdown 为 HTML
const renderedHtml = computed(() => (isUser.value ? '' : md.render(props.content)));
</script>

<template>
  <!-- 对应原 MessageBubble.tsx 外层 div：flexDirection 根据角色反转 -->
  <div class="msg-bubble" :class="{ 'msg-bubble--user': isUser }">
    <!-- Avatar -->
    <div class="msg-bubble__avatar" :class="{ 'msg-bubble__avatar--user': isUser }">
      <UserOutlined v-if="isUser" />
      <RobotOutlined v-else />
    </div>

    <!-- Content -->
    <div class="msg-bubble__content" :class="{ 'msg-bubble__content--user': isUser }">
      <template v-if="isUser">
        <div style="white-space: pre-wrap">{{ content }}</div>
      </template>
      <template v-else>
        <!-- 对应原 <div className="markdown-body"><ReactMarkdown> -->
        <div class="markdown-body" v-html="renderedHtml"></div>
        <!-- 对应原流式光标 -->
        <span v-if="isStreaming" class="msg-bubble__cursor" />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 对应原 MessageBubble.tsx 的内联样式 */
.msg-bubble {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  flex-direction: row;
}

.msg-bubble--user {
  flex-direction: row-reverse;
}

.msg-bubble__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #52c41a;
  color: #fff;
  flex-shrink: 0;
  font-size: 14px;
}

.msg-bubble__avatar--user {
  background: #1677ff;
}

.msg-bubble__content {
  flex: 1;
  background: #f5f5f5;
  border-radius: 12px;
  border-top-left-radius: 4px;
  padding: 10px 16px;
  line-height: 1.8;
  font-size: 14px;
  word-break: break-word;
}

.msg-bubble__content--user {
  background: #e6f4ff;
  border-radius: 12px;
  border-top-right-radius: 4px;
  border-top-left-radius: 12px;
}

.msg-bubble__cursor {
  display: inline-block;
  width: 6px;
  height: 16px;
  background: #1677ff;
  margin-left: 2px;
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
