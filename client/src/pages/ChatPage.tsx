import { useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import ChatWindow from '../components/chat/ChatWindow';
import { useAppStore } from '../stores/appStore';
import { useChatStore } from '../stores/chatStore';

export default function ChatPage() {
  const fetchChatAssistants = useAppStore((s) => s.fetchChatAssistants);
  const selectedAssistantId = useAppStore((s) => s.selectedAssistantId);
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  // Load chat assistants on mount
  useEffect(() => {
    fetchChatAssistants();
  }, []);

  // Load conversations when assistant changes
  useEffect(() => {
    if (selectedAssistantId) {
      fetchConversations(selectedAssistantId);
    }
  }, [selectedAssistantId]);

  return (
    <MainLayout>
      <ChatWindow />
    </MainLayout>
  );
}
