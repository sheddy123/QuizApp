import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // pdf.js (used by the Android build's PDF import) needs top-level await.
  build: { target: 'es2022' },
  server: {
    port: 5173,
    host: true, // listen on the LAN so phones on the same Wi-Fi can connect
    proxy: {
      '/api': 'http://localhost:5210'
    }
  }
})
