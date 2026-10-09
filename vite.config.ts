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
    rolldownOptions: {
      // Runtime dependencies stay external so consumers install them
      // themselves and their `npm audit` / Dependabot can see and update them
      external: ['vue', 'shiki', 'emoji-picker-element', 'markdown-it', 'turndown', 'dompurify'],
      output: {
        globals: {
          vue: 'Vue',
          shiki: 'shiki',
          'emoji-picker-element': 'EmojiPickerElement',
          'markdown-it': 'markdownit',
          turndown: 'TurndownService',
          dompurify: 'DOMPurify',
        },
      },
    },
    sourcemap: true,
    cssCodeSplit: false,
  },
})
