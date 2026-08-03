import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import ChatPage from '../pages/ChatPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import ResetPasswordPage from '../pages/ResetPasswordPage.vue';
import AdminPage from '../pages/AdminPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginPage },
    { path: '/reset-password', component: ResetPasswordPage },
    { path: '/admin', component: AdminPage },
    { path: '/', component: ChatPage },
    // catch-all -> redirect to home (对应 App.tsx 中 <Route path="*" element={<Navigate to="/" replace />} />)
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// 全局前置守卫：对应 App.tsx 中 checkSession + ProtectedRoute / AdminRoute 的认证逻辑
router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // 首次进入先完成会话检查（对应 App.tsx 中 useEffect 里调用 checkSession）
  if (auth.loading) {
    await auth.checkSession();
  }

  const { user, token } = auth;

  // /login 始终可访问
  if (to.path === '/login') {
    return true;
  }

  // /reset-password：仅当必须重置密码时可访问，否则重定向到首页
  // (对应 App.tsx: user?.mustResetPassword ? <ResetPasswordPage /> : <Navigate to="/" replace />)
  if (to.path === '/reset-password') {
    return user?.mustResetPassword ? true : { path: '/' };
  }

  // /admin：对应 AdminRoute —— 需登录且为管理员
  if (to.path === '/admin') {
    if (!token) return { path: '/login' };
    if (user && !user.isAdmin) return { path: '/' };
    return true;
  }

  // 其余路径（首页）：对应 ProtectedRoute —— 需登录；若需重置密码则跳转
  if (!token) {
    return { path: '/login' };
  }
  if (user?.mustResetPassword) {
    return { path: '/reset-password' };
  }
  return true;
});

export default router;
