import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Use modern Sass API
        api: 'modern'
      }
    }
  },
  server: {
    port: 3001,
    host: true,
    allowedHosts: ['.pinggy.link', 'localhost', '127.0.0.1', 'bot.volleyfun.nl'],
    proxy: {
      // Proxy API requests to backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  define: {
    global: 'globalThis',
  },
})
