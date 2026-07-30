import { Input, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useState, useRef, useEffect } from 'react';

const { TextArea } = Input;

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<any>(null);

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        padding: '12px 20px',
        borderTop: '1px solid #f0f0f0',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        <TextArea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题，按 Enter 发送，Shift+Enter 换行"
          autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={disabled}
          style={{ flex: 1, borderRadius: 8 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          style={{ borderRadius: 8 }}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
