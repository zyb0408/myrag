<script setup lang="ts">
// 对应原 client/src/pages/AdminPage.tsx
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { FormInstance } from 'ant-design-vue';
import { Table, Button, Modal, Form, Input, Space, Card, message, Popconfirm } from 'ant-design-vue';
import {
  PlusOutlined,
  DeleteOutlined,
  KeyOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons-vue';
import type { UserInfo } from '../types';

function getToken() {
  return localStorage.getItem('ragflow_chat_token');
}

async function fetchUsers(): Promise<UserInfo[]> {
  const res = await fetch('/api/admin/users', {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message);
  return data.data;
}

async function createUser(values: { username: string; password: string; displayName: string }) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(values),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message);
  return data.data;
}

async function deleteUser(id: string) {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message);
}

async function resetUserPassword(id: string, newPassword: string) {
  const res = await fetch(`/api/admin/users/${id}/reset-password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ newPassword }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message);
}

const users = ref<UserInfo[]>([]);
const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const resetPwdOpen = ref<string | null>(null);

// 对应原 Form.useForm()：antdv v4 通过 Form ref 暴露 resetFields 等方法
const formRef = ref<FormInstance>();
const pwdFormRef = ref<FormInstance>();

// 创建用户表单值（antdv v4 标准用法）
const createForm = reactive({
  username: '',
  displayName: '',
  password: '',
});

// 重置密码表单值
const pwdForm = reactive({
  newPassword: '',
});

const router = useRouter();

// 对应原 loadUsers（useCallback）
async function loadUsers() {
  loading.value = true;
  try {
    users.value = await fetchUsers();
  } catch {
    message.error('加载用户列表失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadUsers();
});

// 对应原 handleCreate
async function handleCreate(values: any) {
  submitting.value = true;
  try {
    await createUser(values);
    message.success('用户创建成功');
    modalOpen.value = false;
    formRef.value?.resetFields();
    loadUsers();
  } catch (err: any) {
    message.error(err.message || '创建失败');
  } finally {
    submitting.value = false;
  }
}

// 对应原 handleDelete
async function handleDelete(id: string) {
  try {
    await deleteUser(id);
    message.success('已删除');
    loadUsers();
  } catch (err: any) {
    message.error(err.message || '删除失败');
  }
}

// 对应原 handleResetPwd
async function handleResetPwd(values: { newPassword: string }) {
  if (!resetPwdOpen.value) return;
  try {
    await resetUserPassword(resetPwdOpen.value, values.newPassword);
    message.success('密码已重置');
    resetPwdOpen.value = null;
    pwdFormRef.value?.resetFields();
    loadUsers();
  } catch (err: any) {
    message.error(err.message || '重置失败');
  }
}

// 对应原 columns（React render → antdv customRender）
const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '显示名称', dataIndex: 'displayName', key: 'displayName' },
  {
    title: '角色',
    dataIndex: 'isAdmin',
    key: 'isAdmin',
    customRender: ({ text }: { text: boolean }) => (text ? '管理员' : '普通用户'),
  },
  {
    title: '状态',
    dataIndex: 'mustResetPassword',
    key: 'status',
    customRender: ({ text }: { text: boolean }) => (text ? '待重置密码' : '正常'),
  },
  {
    title: '操作',
    key: 'actions',
  },
];
</script>

<template>
  <div class="admin-page">
    <div class="admin-page__header">
      <Space>
        <Button @click="router.push('/')">
          <template #icon><ArrowLeftOutlined /></template>
          返回
        </Button>
        <h2 style="margin: 0; font-size: 18px">用户管理</h2>
      </Space>
      <Button type="primary" @click="modalOpen = true">
        <template #icon><PlusOutlined /></template>
        添加用户
      </Button>
    </div>

    <Card>
      <!-- 对应原 Table：render 列在插槽中实现，pagination=false -->
      <Table
        :data-source="users"
        :columns="columns"
        row-key="id"
        :loading="loading"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'actions'">
            <Space>
              <Button
                type="link"
                size="small"
                @click="
                  () => {
                    resetPwdOpen = record.id;
                    pwdFormRef?.resetFields();
                  }
                "
              >
                <template #icon><KeyOutlined /></template>
                重置密码
              </Button>
              <Popconfirm
                title="确认删除"
                :description="`删除用户「${record.displayName}」？`"
                ok-text="删除"
                ok-type="danger"
                cancel-text="取消"
                @confirm="handleDelete(record.id)"
              >
                <Button type="link" size="small" danger>
                  <template #icon><DeleteOutlined /></template>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <!-- 对应原创建用户 Modal：open → v-model:open；footer=null；destroyOnClose -->
    <Modal
      :open="modalOpen"
      title="添加用户"
      :footer="null"
      destroy-on-close
      @cancel="modalOpen = false"
    >
      <Form ref="formRef" :model="createForm" layout="vertical" @finish="handleCreate">
        <Form.Item
          name="username"
          label="用户名"
          :rules="[{ required: true, message: '请输入用户名' }]"
        >
          <Input v-model:value="createForm.username" placeholder="登录用户名" />
        </Form.Item>
        <Form.Item
          name="displayName"
          label="显示名称"
          :rules="[{ required: true, message: '请输入显示名称' }]"
        >
          <Input v-model:value="createForm.displayName" placeholder="用户显示名称" />
        </Form.Item>
        <Form.Item
          name="password"
          label="初始密码"
          :rules="[
            { required: true, message: '请输入初始密码' },
            { min: 6, message: '密码至少 6 位' },
          ]"
        >
          <Input.Password v-model:value="createForm.password" placeholder="用户首次登录后可自行修改" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" html-type="submit" :loading="submitting" block>
            创建用户
          </Button>
        </Form.Item>
      </Form>
    </Modal>

    <!-- 对应原重置密码 Modal -->
    <Modal
      :open="!!resetPwdOpen"
      title="重置用户密码"
      :footer="null"
      destroy-on-close
      @cancel="resetPwdOpen = null"
    >
      <Form ref="pwdFormRef" :model="pwdForm" layout="vertical" @finish="handleResetPwd">
        <Form.Item
          name="newPassword"
          label="新密码"
          :rules="[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少 6 位' },
          ]"
        >
          <Input.Password v-model:value="pwdForm.newPassword" placeholder="用户下次登录需使用此密码" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" html-type="submit" block>
            确认重置
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>
/* 对应原 AdminPage.tsx 的内联样式 */
.admin-page {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.admin-page__header {
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
