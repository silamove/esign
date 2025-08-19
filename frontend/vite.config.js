import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable fast refresh
      fastRefresh: true,
    })
  ],
  server: {
    port: 3000,
    host: true,
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      }
    },
    // Hot Module Replacement settings
    hmr: {
      overlay: true,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    // Add environment variables
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
})
