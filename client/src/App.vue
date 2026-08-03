<script setup lang="ts">
import { onMounted } from 'vue';
import { ConfigProvider } from 'ant-design-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { useAuthStore } from './stores/auth';

// 对应原 App.tsx 中 AppRoutes 组件：
// 挂载时先进行会话检查（checkSession），loading 期间返回 null
const auth = useAuthStore();

onMounted(() => {
  auth.checkSession();
});

const theme = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  },
};
</script>

<template>
  <!-- 对应原 App.tsx 中 ConfigProvider（locale=zhCN + theme token） -->
  <ConfigProvider :locale="zhCN" :theme="theme">
    <router-view />
  </ConfigProvider>
</template>
