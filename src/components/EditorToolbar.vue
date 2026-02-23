<template>
  <div class="ce-toolbar" role="toolbar" aria-label="Formatting toolbar">
    <template v-for="(item, index) in items" :key="item.id">
      <!-- Divider -->
      <span v-if="item.divider && index > 0" class="ce-toolbar__divider" aria-hidden="true" />

      <!-- Button -->
      <button
        type="button"
        class="ce-toolbar__btn"
        :class="{ 'ce-toolbar__btn--active': item.active?.(ctx) }"
        :aria-label="item.label"
        :title="item.shortcut ? `${item.label} (${item.shortcut})` : item.label"
        :disabled="disabled"
        @click="handleAction(item)"
      >
        <component :is="item.icon" :size="18" />
      </button>
    </template>

    <!-- Spacer pushes the mode toggle to the right -->
    <span class="ce-toolbar__spacer" />

    <!-- Mode toggle -->
    <button
      type="button"
      class="ce-toolbar__btn ce-toolbar__mode-btn"
      :aria-label="mode === 'wysiwyg' ? 'Switch to Markdown mode' : 'Switch to Visual mode'"
      :title="mode === 'wysiwyg' ? 'Markdown mode' : 'Visual mode'"
      :disabled="disabled"
      @click="$emit('toggle-mode')"
    >
      <component :is="mode === 'wysiwyg' ? FileCode : Eye" :size="18" />
      <span>{{ mode === 'wysiwyg' ? 'MD' : 'Visual' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Quote,
  Code,
  CodeXml,
  Link,
  Image,
  Minus,
  Table,
  Undo2,
  Redo2,
  FileCode,
  Eye,
} from 'lucide-vue-next'
import type { ToolbarItem, EditorContext, EditorMode } from '@/types'

/* ---- Props / Emits ---- */

const props = defineProps<{
  mode: EditorMode
  disabled?: boolean
  customItems?: ToolbarItem[]
  ctx: EditorContext
}>()

const emit = defineEmits<{
  action: [actionName: string, ...args: unknown[]]
  'toggle-mode': []
}>()

/* ---- Default toolbar items ---- */

const defaultItems: ToolbarItem[] = [
  {
    id: 'bold', label: 'Bold', icon: Bold, action: 'bold',
    shortcut: 'Ctrl+B',
    active: (ctx) => ctx.isActive('strong'),
  },
  {
    id: 'italic', label: 'Italic', icon: Italic, action: 'italic',
    shortcut: 'Ctrl+I',
    active: (ctx) => ctx.isActive('em'),
  },
  {
    id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough,
    action: 'strikethrough',
    active: (ctx) => ctx.isActive('del') || ctx.isActive('s'),
  },
  // --- group divider ---
  {
    id: 'heading1', label: 'Heading 1', icon: Heading1, action: 'heading1',
    divider: true,
    active: (ctx) => ctx.isActive('h1'),
  },
  {
    id: 'heading2', label: 'Heading 2', icon: Heading2, action: 'heading2',
    active: (ctx) => ctx.isActive('h2'),
  },
  {
    id: 'heading3', label: 'Heading 3', icon: Heading3, action: 'heading3',
    active: (ctx) => ctx.isActive('h3'),
  },
  // --- group divider ---
  {
    id: 'bulletList', label: 'Bullet List', icon: List, action: 'bulletList',
    divider: true,
    active: (ctx) => ctx.isActive('ul'),
  },
  {
    id: 'orderedList', label: 'Ordered List', icon: ListOrdered, action: 'orderedList',
    active: (ctx) => ctx.isActive('ol'),
  },
  {
    id: 'indentList', label: 'Indent List', icon: IndentIncrease, action: 'indentList',
    shortcut: 'Tab',
  },
  {
    id: 'outdentList', label: 'Outdent List', icon: IndentDecrease, action: 'outdentList',
    shortcut: 'Shift+Tab',
  },
  // --- group divider ---
  {
    id: 'blockquote', label: 'Blockquote', icon: Quote, action: 'blockquote',
    divider: true,
    active: (ctx) => ctx.isActive('blockquote'),
  },
  {
    id: 'codeInline', label: 'Inline Code', icon: Code, action: 'codeInline',
    active: (ctx) => ctx.isActive('code'),
  },
  {
    id: 'codeBlock', label: 'Code Block', icon: CodeXml, action: 'codeBlock',
    active: (ctx) => ctx.isActive('pre'),
  },
  // --- group divider ---
  {
    id: 'link', label: 'Link', icon: Link, action: 'link',
    divider: true,
    shortcut: 'Ctrl+K',
    active: (ctx) => ctx.isActive('a'),
  },
  {
    id: 'image', label: 'Image', icon: Image, action: 'image',
  },
  {
    id: 'hr', label: 'Horizontal Rule', icon: Minus, action: 'horizontalRule',
  },
  {
    id: 'table', label: 'Table', icon: Table, action: 'table',
    active: (ctx) => ctx.isActive('table'),
  },
  // --- group divider ---
  {
    id: 'undo', label: 'Undo', icon: Undo2, action: 'undo',
    divider: true,
    shortcut: 'Ctrl+Z',
  },
  {
    id: 'redo', label: 'Redo', icon: Redo2, action: 'redo',
    shortcut: 'Ctrl+Shift+Z',
  },
]

const items = computed(() => props.customItems ?? defaultItems)

/* ---- Action dispatch ---- */

function handleAction(item: ToolbarItem): void {
  emit('action', item.action)
}
</script>
