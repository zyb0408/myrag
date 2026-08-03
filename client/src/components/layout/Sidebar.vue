<script setup lang="ts">
// 对应原 client/src/components/layout/Sidebar.tsx
import { h } from 'vue';
import { useRouter } from 'vue-router';
import type { MenuProps } from 'ant-design-vue';
import { Divider, Button, Dropdown, Menu, message } from 'ant-design-vue';
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons-vue';
import KBSelector from '../knowledge-base/KBSelector.vue';
import ConversationList from '../conversation/ConversationList.vue';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
import { useChatStore } from '../../stores/chat';
import { createConversation } from '../../services/api';

const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const chatStore = useChatStore();

// 对应原 handleSelectConversation
function handleSelectConversation(id: string) {
  chatStore.setCurrentConversation(id);
  chatStore.fetchMessages(id);
}

// 对应原 handleNewConversation
async function handleNewConversation() {
  if (!appStore.selectedAssistantId || !appStore.selectedAssistantName) return;
  try {
    const conv = await createConversation({
      name: `新对话`,
      assistant_id: appStore.selectedAssistantId,
      kb_id: appStore.selectedAssistantId,
      kb_name: appStore.selectedKbName || appStore.selectedAssistantName,
    });
    await chatStore.fetchConversations(appStore.selectedAssistantId);
    chatStore.setCurrentConversation(conv.id);
    message.success('新建对话成功');
  } catch {
    message.error('新建对话失败');
  }
}

// 对应原 handleLogout
function handleLogout() {
  authStore.logout();
  router.push('/login');
}

// 对应原 userMenuItems；item 的 onClick 统一在 menu onClick 中按 key 分发
// antdv v4 Dropdown 使用 #overlay 插槽 + Menu 组件（menu.items 不会被自动渲染）
const userMenuItems: MenuProps['items'] = [
  ...(authStore.user?.isAdmin
    ? [{ key: 'admin', icon: h(SettingOutlined), label: '用户管理' }]
    : []),
  { type: 'divider', key: 'divider' },
  { key: 'logout', icon: h(LogoutOutlined), label: '退出登录' },
];

function handleUserMenuClick(info: { key: string | number }) {
  const key = String(info.key);
  if (key === 'admin') {
    router.push('/admin');
  } else if (key === 'logout') {
    handleLogout();
  }
}
</script>

<template>
  <div class="sidebar">
    <!-- Header -->
    <div class="sidebar__header">
      <h2 class="sidebar__title">知识库问答</h2>
      <div class="sidebar__subtitle">基于 RAGFlow 的内部知识库</div>
    </div>

    <Divider style="margin: 0" />

    <!-- Knowledge Base Selector -->
    <div class="sidebar__section">
      <div class="sidebar__label">知识库</div>
      <KBSelector />
    </div>

    <Divider style="margin: 0" />

    <!-- Conversation List -->
    <ConversationList
      :conversations="chatStore.conversations"
      :current-id="chatStore.currentConversationId"
      :loading="chatStore.loadingConversations"
      :selected-assistant-id="appStore.selectedAssistantId"
      @select="handleSelectConversation"
      @new="handleNewConversation"
      @refresh="chatStore.fetchConversations(appStore.selectedAssistantId || undefined)"
    />

    <!-- User info bar -->
    <Divider style="margin: 0" />
    <div class="sidebar__user">
      <Dropdown trigger="click" placement="topRight">
        <div class="sidebar__user-inner">
          <div class="sidebar__avatar">
            <UserOutlined style="color: #fff; font-size: 14px" />
          </div>
          <div style="flex: 1">
            <div class="sidebar__username">
              {{ authStore.user?.displayName || authStore.user?.username || '用户' }}
            </div>
            <div class="sidebar__role">
              {{ authStore.user?.isAdmin ? '管理员' : '普通用户' }}
            </div>
          </div>
        </div>
        <!-- 对应原 Dropdown menu={{items}}：antdv 使用 #overlay 插槽渲染 Menu -->
        <template #overlay>
          <Menu :items="userMenuItems" @click="handleUserMenuClick" />
        </template>
      </Dropdown>
    </div>
  </div>
</template>

<style scoped>
/* 对应原 Sidebar.tsx 的内联样式 */
.sidebar {
  width: 280px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #f0f0f0;
  background: #fafafa;
}

.sidebar__header {
  padding: 12px 16px;
}

.sidebar__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.sidebar__subtitle {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.sidebar__section {
  padding: 12px;
}

.sidebar__label {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
  font-weight: 500;
}

.sidebar__user {
  padding: 8px 16px;
}

.sidebar__user-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.sidebar__user-inner:hover {
  background: #f0f0f0;
}

.sidebar__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #1677ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar__username {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}

.sidebar__role {
  font-size: 11px;
  color: #999;
}
</style>
