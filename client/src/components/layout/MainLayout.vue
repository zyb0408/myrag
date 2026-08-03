<script setup lang="ts">
// 对应原 client/src/components/layout/MainLayout.tsx
// React 的 children prop 在 Vue 中通过默认插槽承载
import Sidebar from './Sidebar.vue';
</script>

<template>
  <div class="main-layout">
    <Sidebar />
    <div class="main-layout__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* 对应原 MainLayout.tsx 的内联样式：display:flex; height:100vh; overflow:hidden */
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.main-layout__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
