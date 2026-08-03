<script setup lang="ts">
// 对应原 client/src/pages/ResetPasswordPage.tsx
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Form, Input, Button, Card, message } from 'ant-design-vue';
import { LockOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '../stores/auth';

const loading = ref(false);
const authStore = useAuthStore();
const router = useRouter();

// 表单值绑定（antdv v4 标准用法，对应 React 受控组件）
const formState = reactive({
  oldPassword: '',
  newPassword: '',
});

// 对应原 handleSubmit
async function handleSubmit(values: { oldPassword: string; newPassword: string }) {
  if (!authStore.user) return;
  if (values.newPassword.length < 6) {
    message.error('新密码至少 6 位');
    return;
  }
  loading.value = true;
  try {
    await authStore.resetPassword(
      authStore.user.username,
      values.oldPassword,
      values.newPassword
    );
    message.success('密码修改成功，请重新登录');
    authStore.setUser({ ...authStore.user, mustResetPassword: false });
    router.replace('/');
  } catch (err: any) {
    message.error(err.message || '修改失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <!-- 对应原 ResetPasswordPage.tsx 的内联样式 -->
  <div class="reset-page">
    <Card title="首次登录，请重置密码" class="reset-card">
      <p style="color: #999; margin-bottom: 16px; font-size: 13px">
        账号 <b>{{ authStore.user?.displayName || authStore.user?.username }}</b
        >，请设置新密码
      </p>
      <Form :model="formState" layout="vertical" size="large" @finish="handleSubmit">
        <Form.Item
          name="oldPassword"
          :rules="[{ required: true, message: '请输入原密码' }]"
        >
          <Input.Password v-model:value="formState.oldPassword" placeholder="原密码">
            <template #prefix><LockOutlined /></template>
          </Input.Password>
        </Form.Item>
        <Form.Item
          name="newPassword"
          :rules="[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少 6 位' },
          ]"
        >
          <Input.Password v-model:value="formState.newPassword" placeholder="新密码（至少 6 位）">
            <template #prefix><LockOutlined /></template>
          </Input.Password>
        </Form.Item>
        <Form.Item>
          <Button type="primary" html-type="submit" :loading="loading" block>
            确认修改
          </Button>
        </Form.Item>
      </Form>
    </Card>
  </div>
</template>

<style scoped>
.reset-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.reset-card {
  width: 400px;
  border-radius: 12px;
}
</style>
