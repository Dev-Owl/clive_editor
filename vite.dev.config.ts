import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [
    vue(),
  ],
  root: resolve(__dirname, 'dev'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
