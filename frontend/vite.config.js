import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/find-bot': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
    
    host: '0.0.0.0',
     // or any port you want
  },

  plugins: [react(),
    tailwindcss(),

  ],
})
