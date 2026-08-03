<script setup lang="ts">
// 对应原 client/src/components/conversation/ConversationItem.tsx
import { ref, h } from 'vue';
import type { MenuProps } from 'ant-design-vue';
import { Button, Dropdown, Modal, Input, Menu, message } from 'ant-design-vue';
import { EditOutlined, DeleteOutlined, EllipsisOutlined } from '@ant-design/icons-vue';
import { renameConversation, deleteConversation } from '../../services/api';
import type { Conversation } from '../../types';

const props = defineProps<{
  conversation: Conversation;
  isActive: boolean;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'deleted'): void;
  (e: 'renamed'): void;
}>();

// 对应原 useState
const renameOpen = ref(false);
const newName = ref(props.conversation.name);
const deleting = ref(false);

// 对应原 handleRename
async function handleRename() {
  if (!newName.value.trim()) return;
  try {
    await renameConversation(props.conversation.id, newName.value.trim());
    message.success('重命名成功');
    renameOpen.value = false;
    emit('renamed');
  } catch {
    message.error('重命名失败');
  }
}

// 对应原 handleDelete
async function handleDelete() {
  deleting.value = true;
  try {
    await deleteConversation(props.conversation.id);
    message.success('已删除');
    emit('deleted');
  } catch {
    message.error('删除失败');
  } finally {
    deleting.value = false;
  }
}

// 对应原 menuItems（items 的 onClick 迁移到 Dropdown 的 :menu.onClick）
// antdv v4：icon 需为 VNode（用 h() 渲染），divider 项需要 key
const menuItems: MenuProps['items'] = [
  { key: 'rename', icon: h(EditOutlined), label: '重命名' },
  { type: 'divider', key: 'divider' },
  { key: 'delete', icon: h(DeleteOutlined), label: '删除', danger: true },
];

// 对应原菜单项 onClick：e.domEvent.stopPropagation() + 打开重命名弹窗 / 删除确认
function handleMenuClick(info: { key: string | number; domEvent: Event }) {
  info.domEvent.stopPropagation();
  const key = String(info.key);
  if (key === 'rename') {
    newName.value = props.conversation.name;
    renameOpen.value = true;
  } else if (key === 'delete') {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除对话「${props.conversation.name}」吗？删除后不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: handleDelete,
    });
  }
}
</script>

<template>
  <div>
    <!-- 对应原外层 div：onClick + 内联样式 -->
    <div
      class="conv-item"
      :class="{ 'conv-item--active': isActive }"
      @click="emit('click')"
    >
      <div class="conv-item__name">{{ conversation.name }}</div>
      <!-- 对应原 Dropdown：menu.items + trigger=click（antdv 使用 #overlay 插槽） -->
      <Dropdown trigger="click" placement="bottomRight">
        <Button
          type="text"
          size="small"
          :loading="deleting"
          @click.stop
        >
          <template #icon><EllipsisOutlined /></template>
        </Button>
        <template #overlay>
          <Menu :items="menuItems" @click="handleMenuClick" />
        </template>
      </Dropdown>
    </div>

    <!-- 对应原重命名 Modal：open → v-model:open；Input value/onChange → v-model:value -->
    <Modal
      :open="renameOpen"
      :title="'重命名对话'"
      :ok-text="'确定'"
      :cancel-text="'取消'"
      @ok="handleRename"
      @cancel="renameOpen = false"
    >
      <Input
        v-model:value="newName"
        placeholder="输入新名称"
        @pressEnter="handleRename"
      />
    </Modal>
  </div>
</template>

<style scoped>
/* 对应原 ConversationItem.tsx 的内联样式 */
.conv-item {
  padding: 10px 12px;
  margin: 2px 8px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.conv-item:hover {
  background: #f5f5f5;
}

.conv-item--active {
  background: #e6f4ff;
  border-color: #91caff;
}

.conv-item--active:hover {
  background: #e6f4ff;
}

.conv-item__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
</style>
