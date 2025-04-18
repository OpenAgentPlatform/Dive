import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  return {
    build: {
      target: 'esnext',
    },
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src'),
        '@services': path.join(__dirname, 'services')
      },
    },
    plugins: [
      react(),
    ],
    server: {
      proxy: {
        '/api': 'http://localhost:8000',
      },
      watch: {
        ignored: ["**/mcp-host/**"],
        exclude: ["**/mcp-host/**"],
      },
    }
  }
})
