import { Select } from 'antd';
import { useAppStore } from '../../stores/appStore';

export default function KBSelector() {
  const chatAssistants = useAppStore((s) => s.chatAssistants);
  const selectedAssistantId = useAppStore((s) => s.selectedAssistantId);
  const selectAssistant = useAppStore((s) => s.selectAssistant);
  const loading = useAppStore((s) => s.loadingAssistants);

  const options = chatAssistants
    .filter((a) => a.status === '1')
    .map((a) => ({
      value: a.id,
      label: a.name,
      kbName: a.kb_names?.join(', ') || '',
    }));

  const handleChange = (value: string) => {
    const assistant = chatAssistants.find((a) => a.id === value);
    if (assistant) {
      selectAssistant(
        assistant.id,
        assistant.name,
        assistant.kb_names?.join(', ') || ''
      );
    }
  };

  return (
    <div style={{ padding: '0 4px' }}>
      <Select
        value={selectedAssistantId}
        onChange={handleChange}
        placeholder="选择知识库"
        loading={loading}
        style={{ width: '100%' }}
        options={options}
        optionRender={(option) => (
          <div>
            <div style={{ fontWeight: 500 }}>{option.label}</div>
            {option.data.kbName && (
              <div style={{ fontSize: 12, color: '#999' }}>
                知识库: {option.data.kbName}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
