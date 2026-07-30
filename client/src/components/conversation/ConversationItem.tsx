import { Button, Dropdown, Modal, Input, message } from 'antd';
import type { MenuProps } from 'antd';
import { EditOutlined, DeleteOutlined, EllipsisOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { renameConversation, deleteConversation } from '../../services/api';
import type { Conversation } from '../../types';

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDeleted: () => void;
  onRenamed: () => void;
}

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
  onDeleted,
  onRenamed,
}: Props) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(conversation.name);
  const [deleting, setDeleting] = useState(false);

  const handleRename = async () => {
    if (!newName.trim()) return;
    try {
      await renameConversation(conversation.id, newName.trim());
      message.success('重命名成功');
      setRenameOpen(false);
      onRenamed();
    } catch {
      message.error('重命名失败');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteConversation(conversation.id);
      message.success('已删除');
      onDeleted();
    } catch {
      message.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: (e) => {
        e.domEvent.stopPropagation();
        setNewName(conversation.name);
        setRenameOpen(true);
      },
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: (e) => {
        e.domEvent.stopPropagation();
        Modal.confirm({
          title: '确认删除',
          content: `确定要删除对话「${conversation.name}」吗？删除后不可恢复。`,
          okText: '删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: handleDelete,
        });
      },
    },
  ];

  return (
    <>
      <div
        onClick={onClick}
        style={{
          padding: '10px 12px',
          margin: '2px 8px',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isActive ? '#e6f4ff' : 'transparent',
          border: isActive ? '1px solid #91caff' : '1px solid transparent',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = '#f5f5f5';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
          }}
        >
          {conversation.name}
        </div>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<EllipsisOutlined />}
            loading={deleting}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      </div>

      <Modal
        title="重命名对话"
        open={renameOpen}
        onOk={handleRename}
        onCancel={() => setRenameOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleRename}
          placeholder="输入新名称"
        />
      </Modal>
    </>
  );
}
