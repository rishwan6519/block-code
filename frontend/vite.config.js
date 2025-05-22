import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    proxy: {
      '/ws': {
        target: 'ws://c20000002.local:9090', // your WebSocket server
        ws: true,                            // enables websocket proxying
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, ''),
      },
    },
    host: '0.0.0.0',
    allowedHosts: ['d52a-49-37-227-80.ngrok-free.app'], // only if needed for external access
  },
  plugins: [react(), tailwindcss()],
})
