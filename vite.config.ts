import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    headers: {
      // Add a more permissive Content-Security-Policy for development
      'Content-Security-Policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'none';"
    }
  },
  build: {
    // Set to false to prevent inline scripts
    // which can trigger CSP issues
    sourcemap: true,
    rollupOptions: {
      output: {
        // Ensure scripts don't use eval in production
        format: 'es'
      }
    }
  }
})
