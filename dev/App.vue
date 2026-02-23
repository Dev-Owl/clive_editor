<template>
  <div class="playground">
    <h1>CliveEdit — Dev Playground</h1>
    <p class="subtitle">A themeable WYSIWYG markdown editor for Vue 3</p>

    <!-- Options panel -->
    <div class="options-panel">
      <div class="options-panel__header">
        <span class="options-panel__title">Options</span>
        <div class="options-panel__toggles">
          <label class="toggle">
            <input type="checkbox" v-model="syntaxHighlight" />
            <span>Syntax highlighting</span>
          </label>
          <label class="toggle">
            <input type="checkbox" v-model="darkMode" />
            <span>Dark theme</span>
          </label>
        </div>
      </div>

      <div class="options-panel__section">
        <span class="options-panel__section-title">Toolbar features</span>
        <div class="options-panel__grid">
          <label v-for="item in allToolbarFeatures" :key="item.id" class="toggle">
            <input type="checkbox" :checked="enabledFeatures[item.id]" @change="toggleFeature(item.id)" />
            <span>{{ item.label }}</span>
          </label>
        </div>
        <div class="options-panel__actions">
          <button class="options-panel__btn" @click="setAll(true)">Enable all</button>
          <button class="options-panel__btn" @click="setAll(false)">Disable all</button>
        </div>
      </div>
    </div>

    <!-- Editor -->
    <div :class="{ 'dark-theme': darkMode }">
      <CliveEdit v-model="markdown" v-model:mode="mode" :toolbar-items="activeToolbarItems"
        :highlight-options="syntaxHighlight ? highlightConfig : undefined"
        placeholder="Start writing something amazing..." />
    </div>

    <!-- Debug output -->
    <details class="debug" open>
      <summary>Raw markdown output</summary>
      <pre class="debug__pre">{{ markdown }}</pre>
    </details>

    <details class="debug">
      <summary>Current mode</summary>
      <pre class="debug__pre">{{ mode }}</pre>
    </details>

    <!-- Markdown Viewer showcase -->
    <h2 class="section-heading">MarkdownViewer — Read-only Renderer</h2>
    <p class="subtitle">The same markdown rendered as a read-only view. Use
      <code>&lt;MarkdownViewer v-model="md" /&gt;</code> for display-only scenarios.
    </p>
    <div :class="{ 'dark-theme': darkMode }">
      <MarkdownViewer v-model="markdown" :highlight-options="syntaxHighlight ? highlightConfig : undefined" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { CliveEdit, MarkdownViewer } from '../src'
import type { EditorMode, ToolbarItem } from '../src'
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
} from 'lucide-vue-next'
import readmeContent from '../README.md?raw'

/* ---- State ---- */

const darkMode = ref(false)
const syntaxHighlight = ref(true)
const mode = ref<EditorMode>('wysiwyg')
const markdown = ref(readmeContent)

const highlightConfig = computed(() => ({
  theme: 'github-light',
  darkTheme: 'github-dark',
  darkMode: darkMode.value,
  langs: [
    'javascript', 'typescript', 'vue', 'html', 'css', 'json',
    'python', 'bash', 'shell', 'markdown', 'jsx', 'tsx', 'csharp'
  ],
}))

/* ---- Toolbar feature definitions ---- */

interface FeatureDef {
  id: string
  label: string
  toolbarItem: ToolbarItem
}

const allToolbarFeatures: FeatureDef[] = [
  {
    id: 'bold', label: 'Bold',
    toolbarItem: {
      id: 'bold', label: 'Bold', icon: Bold, action: 'bold',
      shortcut: 'Ctrl+B',
      active: (ctx) => ctx.isActive('strong'),
    },
  },
  {
    id: 'italic', label: 'Italic',
    toolbarItem: {
      id: 'italic', label: 'Italic', icon: Italic, action: 'italic',
      shortcut: 'Ctrl+I',
      active: (ctx) => ctx.isActive('em'),
    },
  },
  {
    id: 'strikethrough', label: 'Strikethrough',
    toolbarItem: {
      id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough,
      action: 'strikethrough',
      active: (ctx) => ctx.isActive('del') || ctx.isActive('s'),
    },
  },
  {
    id: 'heading1', label: 'Heading 1',
    toolbarItem: {
      id: 'heading1', label: 'Heading 1', icon: Heading1, action: 'heading1',
      divider: true,
      active: (ctx) => ctx.isActive('h1'),
    },
  },
  {
    id: 'heading2', label: 'Heading 2',
    toolbarItem: {
      id: 'heading2', label: 'Heading 2', icon: Heading2, action: 'heading2',
      active: (ctx) => ctx.isActive('h2'),
    },
  },
  {
    id: 'heading3', label: 'Heading 3',
    toolbarItem: {
      id: 'heading3', label: 'Heading 3', icon: Heading3, action: 'heading3',
      active: (ctx) => ctx.isActive('h3'),
    },
  },
  {
    id: 'bulletList', label: 'Bullet List',
    toolbarItem: {
      id: 'bulletList', label: 'Bullet List', icon: List, action: 'bulletList',
      divider: true,
      active: (ctx) => ctx.isActive('ul'),
    },
  },
  {
    id: 'orderedList', label: 'Ordered List',
    toolbarItem: {
      id: 'orderedList', label: 'Ordered List', icon: ListOrdered, action: 'orderedList',
      active: (ctx) => ctx.isActive('ol'),
    },
  },
  {
    id: 'indentList', label: 'Indent List',
    toolbarItem: {
      id: 'indentList', label: 'Indent List', icon: IndentIncrease, action: 'indentList',
      shortcut: 'Tab',
    },
  },
  {
    id: 'outdentList', label: 'Outdent List',
    toolbarItem: {
      id: 'outdentList', label: 'Outdent List', icon: IndentDecrease, action: 'outdentList',
      shortcut: 'Shift+Tab',
    },
  },
  {
    id: 'blockquote', label: 'Blockquote',
    toolbarItem: {
      id: 'blockquote', label: 'Blockquote', icon: Quote, action: 'blockquote',
      divider: true,
      active: (ctx) => ctx.isActive('blockquote'),
    },
  },
  {
    id: 'codeInline', label: 'Inline Code',
    toolbarItem: {
      id: 'codeInline', label: 'Inline Code', icon: Code, action: 'codeInline',
      active: (ctx) => ctx.isActive('code'),
    },
  },
  {
    id: 'codeBlock', label: 'Code Block',
    toolbarItem: {
      id: 'codeBlock', label: 'Code Block', icon: CodeXml, action: 'codeBlock',
      active: (ctx) => ctx.isActive('pre'),
    },
  },
  {
    id: 'link', label: 'Link',
    toolbarItem: {
      id: 'link', label: 'Link', icon: Link, action: 'link',
      divider: true,
      shortcut: 'Ctrl+K',
      active: (ctx) => ctx.isActive('a'),
    },
  },
  {
    id: 'image', label: 'Image',
    toolbarItem: {
      id: 'image', label: 'Image', icon: Image, action: 'image',
    },
  },
  {
    id: 'hr', label: 'Horizontal Rule',
    toolbarItem: {
      id: 'hr', label: 'Horizontal Rule', icon: Minus, action: 'horizontalRule',
    },
  },
  {
    id: 'table', label: 'Table',
    toolbarItem: {
      id: 'table', label: 'Table', icon: Table, action: 'table',
      active: (ctx) => ctx.isActive('table'),
    },
  },
  {
    id: 'undo', label: 'Undo',
    toolbarItem: {
      id: 'undo', label: 'Undo', icon: Undo2, action: 'undo',
      divider: true,
      shortcut: 'Ctrl+Z',
    },
  },
  {
    id: 'redo', label: 'Redo',
    toolbarItem: {
      id: 'redo', label: 'Redo', icon: Redo2, action: 'redo',
      shortcut: 'Ctrl+Shift+Z',
    },
  },
]

/* ---- Feature toggles ---- */

const enabledFeatures = reactive<Record<string, boolean>>(
  Object.fromEntries(allToolbarFeatures.map((f) => [f.id, true])),
)

function toggleFeature(id: string): void {
  enabledFeatures[id] = !enabledFeatures[id]
}

function setAll(on: boolean): void {
  for (const f of allToolbarFeatures) {
    enabledFeatures[f.id] = on
  }
}

/* ---- Computed toolbar items (respects divider placement) ---- */

const activeToolbarItems = computed<ToolbarItem[]>(() => {
  const items: ToolbarItem[] = []
  for (const f of allToolbarFeatures) {
    if (!enabledFeatures[f.id]) continue
    // Only show a divider if it's not the first visible item
    const item = { ...f.toolbarItem }
    if (item.divider && items.length === 0) {
      item.divider = false
    }
    items.push(item)
  }
  return items
})
</script>

<style>
.playground {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
}

.subtitle {
  color: #666;
  margin-top: -12px;
}

.subtitle code {
  background: #f3f4f6;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 0.9em;
}

.section-heading {
  font-size: 1.35rem;
  font-weight: 600;
  margin-top: 12px;
}

/* ---- Options panel ---- */

.options-panel {
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.options-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.options-panel__toggles {
  display: flex;
  gap: 16px;
}

.options-panel__title {
  font-weight: 600;
  font-size: 0.925rem;
}

.options-panel__section {
  padding: 12px 14px;
}

.options-panel__section-title {
  display: block;
  font-weight: 500;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #666;
  margin-bottom: 8px;
}

.options-panel__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
}

.options-panel__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.options-panel__btn {
  font-size: 0.8rem;
  padding: 3px 10px;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  background: #f9fafb;
  cursor: pointer;
  color: #333;
}

.options-panel__btn:hover {
  background: #e5e7eb;
}

/* ---- Toggle labels ---- */

.toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  font-size: 0.875rem;
}

.toggle input[type="checkbox"] {
  accent-color: #6366f1;
}

/* ---- Debug ---- */

.debug {
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.debug summary {
  padding: 8px 12px;
  background: #f9f9f9;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
}

.debug__pre {
  padding: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
  background: #fafafa;
}

/* ---- Dark theme override ---- */
.dark-theme .cliveedit {
  --ce-bg: #1e1e1e;
  --ce-text: #d4d4d4;
  --ce-border: #3e3e42;
  --ce-toolbar-bg: #252526;
  --ce-toolbar-border: #3e3e42;
  --ce-toolbar-btn-hover: #3e3e42;
  --ce-toolbar-btn-active: #505054;
  --ce-code-bg: #2d2d30;
  --ce-code-text: #ce9178;
  --ce-blockquote-border: #6366f1;
  --ce-link-color: #4fc1ff;
  --ce-selection-bg: rgba(38, 79, 120, 0.5);
  --ce-placeholder-color: #6a6a6a;
  --ce-focus-ring: rgba(99, 102, 241, 0.5);
  --ce-hr-color: #3e3e42;
  --ce-line-height: 1;
  --ce-img-radius: 4px;
}
</style>
