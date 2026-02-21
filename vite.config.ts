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
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CliveEdit',
      formats: ['es', 'umd'],
      fileName: (format) => `cliveedit.${format}.js`,
    },
    rollupOptions: {
      external: ['vue', 'shiki'],
      output: {
        globals: {
          vue: 'Vue',
          shiki: 'shiki',
        },
      },
    },
    sourcemap: true,
    cssCodeSplit: false,
  },
})
