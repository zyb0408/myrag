interface Props {
  conversationName: string;
  kbName: string;
}

export default function ChatHeader({ conversationName, kbName }: Props) {
  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fff',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{conversationName}</div>
        <div style={{ fontSize: 12, color: '#999' }}>知识库: {kbName}</div>
      </div>
    </div>
  );
}
