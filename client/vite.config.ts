import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        proxyRes: (proxyRes) => {
          // Disable response buffering for SSE streaming
          if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
            proxyRes.headers['x-accel-buffering'] = 'no';
            proxyRes.headers['cache-control'] = 'no-cache';
          }
        },
      },
    },
  },
});
