<script setup lang="ts">
// 对应原 client/src/components/knowledge-base/KBSelector.tsx
import { computed } from 'vue';
import { Select } from 'ant-design-vue';
import { useAppStore } from '../../stores/app';

const appStore = useAppStore();

// 对应原组件中 chatAssistants.filter(a => a.status === '1').map(...)
const options = computed(() =>
  appStore.chatAssistants
    .filter((a) => a.status === '1')
    .map((a) => ({
      value: a.id,
      label: a.name,
      kbName: a.kb_names?.join(', ') || '',
    }))
);

// 对应原 handleChange：find assistant 后调用 selectAssistant
// antdv v4 的 change 回调 value 类型为 SelectValue（含 undefined），用 any 承接后转字符串
function handleChange(value: any) {
  const id = String(value ?? '');
  const assistant = appStore.chatAssistants.find((a) => a.id === id);
  if (assistant) {
    appStore.selectAssistant(
      assistant.id,
      assistant.name,
      assistant.kb_names?.join(', ') || ''
    );
  }
}
</script>

<template>
  <div class="kb-selector">
    <!-- 对应原 Select：value/onChange → v-model:value + @change；optionRender → #option 插槽 -->
    <Select
      :value="appStore.selectedAssistantId ?? undefined"
      :options="options"
      :loading="appStore.loadingAssistants"
      placeholder="选择知识库"
      style="width: 100%"
      @change="handleChange"
    >
      <template #option="{ label, data }">
        <div>
          <div style="font-weight: 500">{{ label }}</div>
          <div v-if="data?.kbName" style="font-size: 12px; color: #999">
            知识库: {{ data?.kbName }}
          </div>
        </div>
      </template>
    </Select>
  </div>
</template>

<style scoped>
.kb-selector {
  padding: 0 4px;
}
</style>
