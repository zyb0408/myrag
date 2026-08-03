<script setup lang="ts">
// 对应原 client/src/pages/LoginPage.tsx
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Form, Input, Button, Card, message } from 'ant-design-vue';
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '../stores/auth';

const loading = ref(false);
const authStore = useAuthStore();
const router = useRouter();

// 对应 React 受控组件：表单值绑定到响应式 model（antdv v4 标准用法）
const formState = reactive({
  username: '',
  password: '',
});

// 对应原 handleSubmit
async function handleSubmit(values: { username: string; password: string }) {
  loading.value = true;
  try {
    await authStore.login(values.username, values.password);
    message.success('登录成功');
    router.replace('/');
  } catch (err: any) {
    message.error(err.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <!-- 对应原 LoginPage.tsx 的内联样式 -->
  <div class="login-page">
    <Card class="login-card">
      <div class="login-brand">
        <div class="login-brand__logo">
          <span style="color: #fff; font-size: 24px; font-weight: 600">R</span>
        </div>
        <h2 class="login-brand__title">知识库问答系统</h2>
        <p class="login-brand__subtitle">请使用您的账号登录</p>
      </div>

      <!-- 对应原 Form：onFinish → @finish；size=large -->
      <Form :model="formState" layout="vertical" size="large" autocomplete="off" @finish="handleSubmit">
        <Form.Item
          name="username"
          :rules="[{ required: true, message: '请输入用户名' }]"
        >
          <Input v-model:value="formState.username" placeholder="用户名">
            <template #prefix><UserOutlined /></template>
          </Input>
        </Form.Item>
        <Form.Item
          name="password"
          :rules="[{ required: true, message: '请输入密码' }]"
        >
          <Input.Password v-model:value="formState.password" placeholder="密码">
            <template #prefix><LockOutlined /></template>
          </Input.Password>
        </Form.Item>
        <Form.Item>
          <Button type="primary" html-type="submit" :loading="loading" block>
            登录
          </Button>
        </Form.Item>
      </Form>
    </Card>
  </div>
</template>

<style scoped>
/* 对应原 LoginPage.tsx 的内联样式 */
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 380px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.login-card :deep(.ant-card-body) {
  padding: 32px 32px 24px;
}

.login-brand {
  text-align: center;
  margin-bottom: 32px;
}

.login-brand__logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: #1677ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.login-brand__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.login-brand__subtitle {
  margin: 8px 0 0;
  color: #999;
  font-size: 13px;
}
</style>
