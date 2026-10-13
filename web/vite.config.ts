import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on the LAN so phones on the same Wi-Fi can connect
    proxy: {
      '/api': 'http://localhost:5210'
    }
  }
})
