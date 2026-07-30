import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ChatPage from './pages/ChatPage';

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        },
      }}
    >
      <ChatPage />
    </ConfigProvider>
  );
}

export default App;
