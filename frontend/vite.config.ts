import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // ── Dev Server Proxy ────────────────────────────────
  // During development, any request starting with /api is forwarded to
  // the Node backend.  This means the frontend can just call `/api/health`
  // without knowing the backend's port — Vite handles the rewrite.
  //
  // WHY: This avoids CORS issues during development and mirrors how a
  // production reverse proxy (e.g., nginx) would work.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
