<script setup lang="ts">
// 对应原 client/src/components/conversation/ConversationList.tsx
import { Button, Spin, Empty } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import ConversationItem from './ConversationItem.vue';
import type { Conversation } from '../../types';

defineProps<{
  conversations: Conversation[];
  currentId: string | null;
  loading: boolean;
  selectedAssistantId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'new'): void;
  (e: 'refresh'): void;
}>();

// antdv 的 Empty 同样导出 PRESENTED_IMAGE_SIMPLE 常量
</script>

<template>
  <div class="conv-list">
    <div class="conv-list__header">
      <span class="conv-list__title">对话列表</span>
      <Button
        type="primary"
        size="small"
        :disabled="!selectedAssistantId"
        @click="emit('new')"
      >
        <template #icon><PlusOutlined /></template>
        新建
      </Button>
    </div>

    <div class="conv-list__body">
      <template v-if="loading">
        <div class="conv-list__loading">
          <Spin size="small" />
        </div>
      </template>
      <template v-else-if="conversations.length === 0">
        <!-- 对应原 Empty：image=PRESENTED_IMAGE_SIMPLE + description -->
        <Empty :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无对话" style="margin-top: 24px">
          <Button type="primary" size="small" :disabled="!selectedAssistantId" @click="emit('new')">
            新建对话
          </Button>
        </Empty>
      </template>
      <template v-else>
        <ConversationItem
          v-for="conv in conversations"
          :key="conv.id"
          :conversation="conv"
          :is-active="conv.id === currentId"
          @click="emit('select', conv.id)"
          @deleted="emit('refresh')"
          @renamed="emit('refresh')"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 对应原 ConversationList.tsx 的内联样式 */
.conv-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.conv-list__header {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conv-list__title {
  font-size: 12px;
  color: #999;
  font-weight: 500;
}

.conv-list__body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 8px;
}

.conv-list__loading {
  text-align: center;
  padding: 24px;
}
</style>
