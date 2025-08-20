import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable fast refresh for React 19
      fastRefresh: true,
      // Include .jsx files
      include: "**/*.{jsx,tsx}",
    })
  ],
  server: {
    port: 3000,
    host: true,
    open: true,
    // Proxy API requests to backend (updated port)
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    },
    // Enhanced Hot Module Replacement settings
    hmr: {
      overlay: true,
      port: 24678,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Modern build target for better performance
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['framer-motion', 'lucide-react'],
          pdf: ['react-pdf', 'pdf-lib'],
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@services': resolve(__dirname, 'src/services'),
      '@utils': resolve(__dirname, 'src/utils'),
    }
  },
  // Enable top-level await and other modern features
  esbuild: {
    target: 'esnext',
    keepNames: true,
  },
  // Optimize dependencies for faster cold starts
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'framer-motion'],
    exclude: ['@vitejs/plugin-react']
  },
  define: {
    // Add environment variables
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    // Support for latest React features
    __REACT_DEVTOOLS_GLOBAL_HOOK__: '({ isDisabled: true })',
  },
})
