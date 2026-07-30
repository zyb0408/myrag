import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Space, Card, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, KeyOutlined, ArrowLeftOutlined } from '@ant-design/icons';
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

export default function AdminPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetPwdOpen, setResetPwdOpen] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const navigate = useNavigate();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const users = await fetchUsers();
      setUsers(users);
    } catch {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      await createUser(values);
      message.success('用户创建成功');
      setModalOpen(false);
      form.resetFields();
      loadUsers();
    } catch (err: any) {
      message.error(err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      message.success('已删除');
      loadUsers();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleResetPwd = async (values: { newPassword: string }) => {
    if (!resetPwdOpen) return;
    try {
      await resetUserPassword(resetPwdOpen, values.newPassword);
      message.success('密码已重置');
      setResetPwdOpen(null);
      pwdForm.resetFields();
      loadUsers();
    } catch (err: any) {
      message.error(err.message || '重置失败');
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '显示名称', dataIndex: 'displayName', key: 'displayName' },
    {
      title: '角色',
      dataIndex: 'isAdmin',
      key: 'isAdmin',
      render: (v: boolean) => (v ? '管理员' : '普通用户'),
    },
    {
      title: '状��',
      dataIndex: 'mustResetPassword',
      key: 'status',
      render: (v: boolean) => (v ? '待重置密码' : '正常'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: UserInfo) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => {
              setResetPwdOpen(record.id);
              pwdForm.resetFields();
            }}
          >
            重置密码
          </Button>
          <Popconfirm
            title="确认删除"
            description={`删除用户「${record.displayName}」？`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            okType="danger"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回
          </Button>
          <h2 style={{ margin: 0, fontSize: 18 }}>用户管理</h2>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          添加用户
        </Button>
      </div>

      <Card>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* Create user modal */}
      <Modal
        title="添加用户"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="用户显示名称" />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            rules={[
              { required: true, message: '请输入初始密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder="用户首次登录后可自行修改" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>
              创建用户
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset password modal */}
      <Modal
        title="重置用户密码"
        open={!!resetPwdOpen}
        onCancel={() => setResetPwdOpen(null)}
        footer={null}
        destroyOnClose
      >
        <Form form={pwdForm} onFinish={handleResetPwd} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder="用户下次登录需使用此密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认重置
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
