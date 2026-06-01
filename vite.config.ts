import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // During dev the LLM proxy runs as a separate Express server (see /server).
      '/api': 'http://localhost:8787',
    },
  },
  worker: {
    format: 'es',
  },
});
