import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Variables from the repository-root `.env` (shared with the backend); the
// shell environment wins. Only VITE_API_PROXY is used here.
const rootEnv = loadEnv('', fileURLToPath(new URL('..', import.meta.url)), '');
const apiProxy = process.env.VITE_API_PROXY ?? rootEnv.VITE_API_PROXY ?? 'http://localhost:8080';

// The API runs on :8080. Both the dev server (5173) and the production
// preview server (3000, `npm start`) proxy /api to it and fall back to
// index.html for client-side routes.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/notifications'],
          charts: ['@mantine/charts', 'recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': apiProxy },
  },
  preview: {
    port: 3000,
    strictPort: true,
    proxy: { '/api': apiProxy },
  },
});
