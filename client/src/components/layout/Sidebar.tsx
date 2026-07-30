import { Divider, Button, Space, Dropdown } from 'antd';
import { useNavigate } from 'react-router-dom';
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';
import KBSelector from '../knowledge-base/KBSelector';
import ConversationList from '../conversation/ConversationList';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { createConversation } from '../../services/api';
import { message } from 'antd';

export default function Sidebar() {
  const selectedAssistantId = useAppStore((s) => s.selectedAssistantId);
  const selectedAssistantName = useAppStore((s) => s.selectedAssistantName);
  const selectedKbName = useAppStore((s) => s.selectedKbName);

  const conversations = useChatStore((s) => s.conversations);
  const currentConvId = useChatStore((s) => s.currentConversationId);
  const loadingConvs = useChatStore((s) => s.loadingConversations);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const fetchMessages = useChatStore((s) => s.fetchMessages);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleSelectConversation = (id: string) => {
    setCurrentConversation(id);
    fetchMessages(id);
  };

  const handleNewConversation = async () => {
    if (!selectedAssistantId || !selectedAssistantName) return;

    try {
      const conv = await createConversation({
        name: `新对话`,
        assistant_id: selectedAssistantId,
        kb_id: selectedAssistantId,
        kb_name: selectedKbName || selectedAssistantName,
      });
      await fetchConversations(selectedAssistantId);
      setCurrentConversation(conv.id);
      message.success('新建对话成功');
    } catch {
      message.error('新建对话失败');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    ...(user?.isAdmin
      ? [
          {
            key: 'admin',
            icon: <SettingOutlined />,
            label: '用户管理',
            onClick: () => navigate('/admin'),
          },
        ]
      : []),
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <div
      style={{
        width: 280,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #f0f0f0',
        background: '#fafafa',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#333' }}>
          知识库问答
        </h2>
        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
          基于 RAGFlow 的内部知识库
        </div>
      </div>

      <Divider style={{ margin: 0 }} />

      {/* Knowledge Base Selector */}
      <div style={{ padding: '12px' }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 6, fontWeight: 500 }}>
          知识库
        </div>
        <KBSelector />
      </div>

      <Divider style={{ margin: 0 }} />

      {/* Conversation List */}
      <ConversationList
        conversations={conversations}
        currentId={currentConvId}
        loading={loadingConvs}
        selectedAssistantId={selectedAssistantId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onRefresh={() => fetchConversations(selectedAssistantId || undefined)}
      />

      {/* User info bar */}
      <Divider style={{ margin: 0 }} />
      <div style={{ padding: '8px 16px' }}>
        <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="topRight">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: 8,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#1677ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>
                {user?.displayName || user?.username || '用户'}
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>
                {user?.isAdmin ? '管理员' : '普通用户'}
              </div>
            </div>
          </div>
        </Dropdown>
      </div>
    </div>
  );
}
