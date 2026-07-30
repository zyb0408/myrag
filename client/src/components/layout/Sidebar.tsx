import { Divider } from 'antd';
import KBSelector from '../knowledge-base/KBSelector';
import ConversationList from '../conversation/ConversationList';
import { useAppStore } from '../../stores/appStore';
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
    </div>
  );
}
