import ReactMarkdown from 'react-markdown';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export default function MessageBubble({ role, content, isStreaming }: Props) {
  const isUser = role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 20px',
        maxWidth: 800,
        margin: '0 auto',
        width: '100%',
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isUser ? '#1677ff' : '#52c41a',
          color: '#fff',
          flexShrink: 0,
          fontSize: 14,
        }}
      >
        {isUser ? <UserOutlined /> : <RobotOutlined />}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          background: isUser ? '#e6f4ff' : '#f5f5f5',
          borderRadius: 12,
          padding: '10px 16px',
          borderTopRightRadius: isUser ? 4 : 12,
          borderTopLeftRadius: isUser ? 12 : 4,
          lineHeight: 1.8,
          fontSize: 14,
          wordBreak: 'break-word',
        }}
      >
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown>{content}</ReactMarkdown>
            {isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 16,
                  background: '#1677ff',
                  marginLeft: 2,
                  animation: 'blink 1s step-end infinite',
                  verticalAlign: 'text-bottom',
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
