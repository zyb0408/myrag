import { defineStore } from 'pinia';
import type { UserInfo } from '../types';

const TOKEN_KEY = 'ragflow_chat_token';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) as string | null,
    user: null as UserInfo | null,
    loading: true,
  }),

  actions: {
    async login(username: string, password: string) {
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
      this.token = data.data.token;
      this.user = data.data.user;
    },

    logout() {
      localStorage.removeItem(TOKEN_KEY);
      this.token = null;
      this.user = null;
    },

    async checkSession() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        this.loading = false;
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.code === 0) {
          this.user = data.data;
          this.token = token;
          this.loading = false;
        } else {
          localStorage.removeItem(TOKEN_KEY);
          this.token = null;
          this.user = null;
          this.loading = false;
        }
      } catch {
        this.loading = false;
      }
    },

    async resetPassword(username: string, oldPassword: string, newPassword: string) {
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

    setUser(user: UserInfo) {
      this.user = user;
    },
  },
});
