import { Button, Spin, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import ConversationItem from './ConversationItem';
import type { Conversation } from '../../types';

interface Props {
  conversations: Conversation[];
  currentId: string | null;
  loading: boolean;
  selectedAssistantId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
}

export default function ConversationList({
  conversations,
  currentId,
  loading,
  selectedAssistantId,
  onSelect,
  onNew,
  onRefresh,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>对话列表</span>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          disabled={!selectedAssistantId}
          onClick={onNew}
        >
          新建
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size="small" />
          </div>
        ) : conversations.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无对话"
            style={{ marginTop: 24 }}
          >
            <Button type="primary" size="small" disabled={!selectedAssistantId} onClick={onNew}>
              新建对话
            </Button>
          </Empty>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === currentId}
              onClick={() => onSelect(conv.id)}
              onDeleted={onRefresh}
              onRenamed={onRefresh}
            />
          ))
        )}
      </div>
    </div>
  );
}
