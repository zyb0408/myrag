<script setup lang="ts">
// 对应原 client/src/components/chat/ChatInput.tsx
import { ref, watch, nextTick } from 'vue';
import { Input, Button } from 'ant-design-vue';
import { SendOutlined, StopOutlined } from '@ant-design/icons-vue';

const { TextArea } = Input;

const props = defineProps<{
  onSend: (content: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
}>();

const value = ref('');
const textareaRef = ref<any>(null);

// 对应原 useEffect：disabled 变化后重新聚焦
watch(
  () => props.disabled,
  async (disabled) => {
    if (!disabled) {
      await nextTick();
      textareaRef.value?.focus();
    }
  }
);

function handleSend() {
  const trimmed = value.value.trim();
  if (!trimmed || props.disabled) return;
  props.onSend(trimmed);
  value.value = '';
}

// 对应原 handleKeyDown：Enter 发送，Shift+Enter 换行
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <div class="chat-input">
    <div class="chat-input__inner">
      <!-- 对应原 TextArea：value/onChange → v-model:value；autoSize；ref -->
      <TextArea
        ref="textareaRef"
        v-model:value="value"
        :auto-size="{ minRows: 1, maxRows: 5 }"
        :disabled="disabled"
        placeholder="输入你的问题，按 Enter 发送，Shift+Enter 换行"
        style="flex: 1; border-radius: 8px"
        @keydown="handleKeyDown"
      />
      <!-- 流式生成中显示「停止」按钮，中断当前生成 -->
      <Button
        v-if="isStreaming"
        danger
        style="border-radius: 8px"
        @click="onStop"
      >
        <template #icon><StopOutlined /></template>
        停止
      </Button>
      <Button
        v-else
        type="primary"
        :disabled="disabled || !value.trim()"
        style="border-radius: 8px"
        @click="handleSend"
      >
        <template #icon><SendOutlined /></template>
        发送
      </Button>
    </div>
  </div>
</template>

<style scoped>
/* 对应原 ChatInput.tsx 的内联样式 */
.chat-input {
  padding: 12px 20px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
}

.chat-input__inner {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  max-width: 800px;
  margin: 0 auto;
}
</style>
