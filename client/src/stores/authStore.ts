import { create } from 'zustand';
import type { UserInfo } from '../types';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  loading: boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<void>;
  resetPassword: (username: string, oldPassword: string, newPassword: string) => Promise<void>;
  setUser: (user: UserInfo) => void;
}

const TOKEN_KEY = 'ragflow_chat_token';

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  loading: true,

  login: async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(data.message || '登录失败');
    }
    localStorage.setItem(TOKEN_KEY, data.data.token);
    set({ token: data.data.token, user: data.data.user });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null });
  },

  checkSession: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        set({ user: data.data, token, loading: false });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  resetPassword: async (username, oldPassword, newPassword) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username, oldPassword, newPassword }),
    });
    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(data.message || '修改密码失败');
    }
  },

  setUser: (user) => set({ user }),
}));
