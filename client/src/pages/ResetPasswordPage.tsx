import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  const handleSubmit = async (values: { oldPassword: string; newPassword: string }) => {
    if (!user) return;
    if (values.newPassword.length < 6) {
      message.error('新密码至少 6 位');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(user.username, values.oldPassword, values.newPassword);
      message.success('密码修改成功，请重新登录');
      setUser({ ...user, mustResetPassword: false });
      navigate('/', { replace: true });
    } catch (err: any) {
      message.error(err.message || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        title="首次登录，请重置密码"
        style={{ width: 400, borderRadius: 12 }}
      >
        <p style={{ color: '#999', marginBottom: 16, fontSize: 13 }}>
          账号 <b>{user?.displayName || user?.username}</b>，请设置新密码
        </p>
        <Form onFinish={handleSubmit} size="large">
          <Form.Item
            name="oldPassword"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="原密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 6 位）" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
