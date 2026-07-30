import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from './stores/authStore';
import { ProtectedRoute, AdminRoute } from './components/auth/ProtectedRoute';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminPage from './pages/AdminPage';

function AppRoutes() {
  const checkSession = useAuthStore((s) => s.checkSession);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    checkSession();
  }, []);

  if (loading) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/reset-password"
        element={
          user?.mustResetPassword ? (
            <ResetPasswordPage />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {user?.mustResetPassword ? (
              <Navigate to="/reset-password" replace />
            ) : (
              <ChatPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

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
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
