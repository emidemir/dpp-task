import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Host başlığını koru: QR adresi, tarayıcının kullandığı frontend portunu taşısın.
const target = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:5228'
const proxy = {
  '/api': { target, changeOrigin: false },
  '/dpp': { target, changeOrigin: false },
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { proxy },
})
