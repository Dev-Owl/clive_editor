# CliveEdit

A themeable WYSIWYG markdown editor component for Vue 3, built with TypeScript.

CliveEdit gives your users a rich editing experience with a familiar toolbar while keeping markdown as the canonical data format. Switch between visual and raw markdown modes, undo/redo with full history, and adapt the look to any design system using CSS custom properties.

**[🚀 Try the Demo](https://dev-owl.github.io/clive_editor/)**

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [MarkdownViewer (Read-only)](#markdownviewer-read-only)
- [Props](#props)
- [Events](#events)
- [v-model Bindings](#v-model-bindings)
- [Exposed Methods](#exposed-methods)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Toolbar](#toolbar)
  - [Default Items](#default-toolbar-items)
  - [Custom Toolbar](#custom-toolbar)
- [Tables](#tables)
  - [Inserting a Table](#inserting-a-table)
  - [Table Controls](#table-controls)
  - [Table Keyboard Navigation](#table-keyboard-navigation)
- [Theming](#theming)
  - [CSS Custom Properties](#css-custom-properties)
  - [Dark Theme Example](#dark-theme-example)
- [Vue Plugin (Global Registration)](#vue-plugin-global-registration)
- [Advanced Usage](#advanced-usage)
  - [EditorContext (Provide / Inject)](#editorcontext-provide--inject)
  - [useHistory Composable](#usehistory-composable)
  - [useEditor Composable](#useeditor-composable)
- [TypeScript](#typescript)
- [Build Scripts](#build-scripts)
- [Browser Support](#browser-support)
- [License](#license)

---

## Installation

```bash
npm install @dev_owl/cliveedit
```

**Peer dependency:** Vue 3.3 or higher.

```bash
npm install vue@^3.5
```

---

## Quick Start

```vue
<template>
  <CliveEdit v-model="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CliveEdit } from '@dev_owl/cliveedit'
import '@dev_owl/cliveedit/style.css'

const content = ref('# Hello World\n\nStart writing **markdown** here.')
</script>
```

That's it. The editor renders a toolbar and a WYSIWYG editing area. The `content` ref always contains the raw markdown string.

---

## MarkdownViewer (Read-only)

Need to display markdown without editing? Use the `MarkdownViewer` component:

```vue
<template>
  <MarkdownViewer v-model="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownViewer } from '@dev_owl/cliveedit'
import '@dev_owl/cliveedit/style.css'

const content = ref('# Hello World\n\nThis is **read-only** markdown.')
</script>
```

The viewer renders markdown to styled HTML using the same theming system as the editor. Links are clickable by default.

### MarkdownViewer Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | `string` | *(required)* | Raw markdown string to render. Use with `v-model`. |
| `bordered` | `boolean` | `true` | Show a border around the viewer. Set to `false` for borderless rendering. |

### Borderless Example

```vue
<MarkdownViewer v-model="content" :bordered="false" />
```

---

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | `string` | *(required)* | Raw markdown content. Use with `v-model`. |
| `mode` | `'wysiwyg' \| 'markdown'` | `'wysiwyg'` | Active editing mode. Use with `v-model:mode`. |
| `placeholder` | `string` | `'Start writing...'` | Placeholder text shown when the editor is empty. |
| `disabled` | `boolean` | `false` | When `true`, disables all editing and toolbar actions. |
| `toolbarItems` | `ToolbarItem[]` | *(built-in set)* | Override the default toolbar. See [Custom Toolbar](#custom-toolbar). |
| `historyDepth` | `number` | `100` | Maximum number of undo/redo history entries. |

---

## Events

| Event | Payload | Description |
|---|---|---|
| `update:modelValue` | `string` | Emitted when the markdown content changes. Used by `v-model`. |
| `update:mode` | `'wysiwyg' \| 'markdown'` | Emitted when the editing mode switches. Used by `v-model:mode`. |

### Usage

```vue
<CliveEdit
  v-model="content"
  @update:modelValue="onContentChange"
  @update:mode="onModeChange"
/>
```

```ts
function onContentChange(markdown: string) {
  console.log('Content changed:', markdown)
}

function onModeChange(mode: 'wysiwyg' | 'markdown') {
  console.log('Mode switched to:', mode)
}
```

---

## v-model Bindings

CliveEdit supports two `v-model` bindings:

```vue
<CliveEdit
  v-model="markdown"
  v-model:mode="editorMode"
/>
```

| Binding | Prop | Event | Description |
|---|---|---|---|
| `v-model` | `modelValue` | `update:modelValue` | Two-way binding for the markdown content. |
| `v-model:mode` | `mode` | `update:mode` | Two-way binding for the editing mode (`'wysiwyg'` or `'markdown'`). |

---

## Exposed Methods

Access these via a template ref:

```vue
<template>
  <CliveEdit ref="editorRef" v-model="content" />
  <button @click="editorRef?.focus()">Focus Editor</button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CliveEdit } from '@dev_owl/cliveedit'

const editorRef = ref<InstanceType<typeof CliveEdit> | null>(null)
const content = ref('')
</script>
```

| Method | Signature | Description |
|---|---|---|
| `getMarkdown()` | `() => string` | Returns the current markdown content. |
| `getMode()` | `() => EditorMode` | Returns the current editing mode. |
| `undo()` | `() => void` | Programmatically trigger undo. |
| `redo()` | `() => void` | Programmatically trigger redo. |
| `focus()` | `() => void` | Focus the active editor area (WYSIWYG or textarea). |

---

## Keyboard Shortcuts

These shortcuts work in both WYSIWYG and Markdown modes:

| Shortcut | Action |
|---|---|
| `Ctrl+B` / `Cmd+B` | Bold |
| `Ctrl+I` / `Cmd+I` | Italic |
| `Ctrl+K` / `Cmd+K` | Insert link |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |
| `Ctrl+Click` / `Cmd+Click` | Open link under cursor in a new tab |
| `Tab` (inside table) | Move to next cell |
| `Shift+Tab` (inside table) | Move to previous cell |
| `Enter` (inside table) | Move to same column in next row |

---

## Toolbar

### Default Toolbar Items

The built-in toolbar includes 17 buttons plus a mode toggle:

| Button | Icon | Action | Active When |
|---|---|---|---|
| **Bold** | `Bold` | Toggle `<strong>` / `**` | Cursor inside bold text |
| **Italic** | `Italic` | Toggle `<em>` / `*` | Cursor inside italic text |
| **Strikethrough** | `Strikethrough` | Toggle `<del>` / `~~` | Cursor inside strikethrough text |
| — | *separator* | | |
| **Heading 1** | `Heading1` | Set/toggle `<h1>` / `#` | Cursor inside H1 |
| **Heading 2** | `Heading2` | Set/toggle `<h2>` / `##` | Cursor inside H2 |
| **Heading 3** | `Heading3` | Set/toggle `<h3>` / `###` | Cursor inside H3 |
| — | *separator* | | |
| **Bullet List** | `List` | Toggle `<ul>` / `- ` | Cursor inside unordered list |
| **Ordered List** | `ListOrdered` | Toggle `<ol>` / `1. ` | Cursor inside ordered list |
| — | *separator* | | |
| **Blockquote** | `Quote` | Toggle `<blockquote>` / `> ` | Cursor inside blockquote |
| **Inline Code** | `Code` | Toggle `<code>` / `` ` `` | Cursor inside code |
| **Code Block** | `CodeXml` | Toggle `<pre>` / ` ``` ` | Cursor inside code block |
| — | *separator* | | |
| **Link** | `Link` | Insert `<a>` / `[](url)` | Cursor inside link |
| **Image** | `Image` | Insert `<img>` / `![alt]()` | — |
| **Horizontal Rule** | `Minus` | Insert `<hr>` / `---` | — |
| **Table** | `Table` | Insert a 3×3 table | Cursor inside a table |
| — | *separator* | | |
| **Undo** | `Undo2` | Undo last change | — |
| **Redo** | `Redo2` | Redo last undone change | — |
| — | *spacer* | | |
| **Mode Toggle** | `FileCode` / `Eye` | Switch between WYSIWYG and Markdown mode | — |

### Custom Toolbar

Pass a `toolbarItems` array to replace the entire toolbar:

```vue
<template>
  <CliveEdit v-model="content" :toolbar-items="myToolbar" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CliveEdit } from '@dev_owl/cliveedit'
import type { ToolbarItem } from '@dev_owl/cliveedit'
import { Bold, Italic, Heading1 } from 'lucide-vue-next'

const content = ref('')

const myToolbar: ToolbarItem[] = [
  {
    id: 'bold',
    label: 'Bold',
    icon: Bold,
    action: 'bold',
    shortcut: 'Ctrl+B',
    active: (ctx) => ctx.isActive('strong'),
  },
  {
    id: 'italic',
    label: 'Italic',
    icon: Italic,
    action: 'italic',
    shortcut: 'Ctrl+I',
    active: (ctx) => ctx.isActive('em'),
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    icon: Heading1,
    action: 'heading1',
    divider: true,  // renders a separator before this item
  },
]
</script>
```

#### ToolbarItem Interface

```ts
interface ToolbarItem {
  id: string              // Unique identifier
  label: string           // Accessible label / tooltip
  icon: Component         // Vue component (Lucide icon or custom)
  action: string          // Action name dispatched on click
  shortcut?: string       // Keyboard shortcut label (display only)
  active?: (ctx: EditorContext) => boolean   // Active state check
  divider?: boolean       // Show separator before this item
}
```

**Available action names:** `bold`, `italic`, `strikethrough`, `heading1`, `heading2`, `heading3`, `bulletList`, `orderedList`, `blockquote`, `codeInline`, `codeBlock`, `link`, `image`, `horizontalRule`, `table`, `undo`, `redo`.

---

## Tables

CliveEdit includes full GFM (GitHub Flavoured Markdown) table support. Tables round-trip cleanly between WYSIWYG and Markdown modes.

### Inserting a Table

Click the **Table** button in the toolbar (or call `ctx.table()` programmatically) to insert a 3×3 starter table with a header row and two body rows. The table is rendered as standard HTML `<table>` markup and serialised to pipe-delimited GFM markdown:

```markdown
| Header | Header | Header |
| --- | --- | --- |
|  |  |  |
|  |  |  |
```

### Table Controls

When the cursor is inside a table, a floating control bar appears above it with the following actions:

| Group | Button | Description |
|---|---|---|
| **Row** | ↑ + | Add a row above the current row |
| **Row** | ↓ + | Add a row below the current row |
| **Row** | ↓ − | Remove the current row (disabled for header rows and the last body row) |
| **Col** | ← + | Add a column to the left |
| **Col** | → + | Add a column to the right |
| **Col** | → − | Remove the current column (disabled when only one column remains) |
| — | 🗑 | Delete the entire table |

The control bar repositions automatically as the selection moves between tables and hides when the cursor leaves all tables.

### Table Keyboard Navigation

| Key | Behaviour |
|---|---|
| `Tab` | Move to the next cell (left → right, then next row). If at the last cell, a new row is appended. |
| `Shift+Tab` | Move to the previous cell. |
| `Enter` | Move to the same column in the next row. If already on the last row, a new row is appended. |

Formatting commands (bold, italic, etc.) work within individual cells. Block-level commands (headings, lists, blockquotes) are disabled when the cursor is inside a table to prevent structural corruption.

---

## Theming

CliveEdit uses CSS custom properties scoped under the `.cliveedit` class. Override any variable to match your application's design system — no JavaScript configuration needed.

### CSS Custom Properties

#### Layout

| Variable | Default | Description |
|---|---|---|
| `--ce-bg` | `#ffffff` | Editor background |
| `--ce-text` | `#1a1a1a` | Text colour |
| `--ce-border` | `#d0d5dd` | Border colour |
| `--ce-radius` | `8px` | Border radius |

#### Toolbar

| Variable | Default | Description |
|---|---|---|
| `--ce-toolbar-bg` | `#f9fafb` | Toolbar background |
| `--ce-toolbar-border` | `#e5e7eb` | Toolbar bottom border |
| `--ce-toolbar-btn-hover` | `#e5e7eb` | Button hover background |
| `--ce-toolbar-btn-active` | `#d0d5dd` | Button active/pressed background |

#### Typography

| Variable | Default | Description |
|---|---|---|
| `--ce-font-family` | System font stack | Content font family |
| `--ce-font-size` | `16px` | Content font size |
| `--ce-line-height` | `1` | Content line height |
| `--ce-mono-font` | `Consolas, monospace...` | Monospace font for code |

#### Content Elements

| Variable | Default | Description |
|---|---|---|
| `--ce-code-bg` | `#f3f4f6` | Code background |
| `--ce-code-text` | `#e11d48` | Inline code text colour |
| `--ce-blockquote-border` | `#6366f1` | Blockquote left border |
| `--ce-link-color` | `#2563eb` | Link colour |
| `--ce-hr-color` | `#d0d5dd` | Horizontal rule colour |

#### Interaction

| Variable | Default | Description |
|---|---|---|
| `--ce-selection-bg` | `rgba(99, 102, 241, 0.2)` | Text selection highlight |
| `--ce-placeholder-color` | `#9ca3af` | Placeholder text colour |
| `--ce-focus-ring` | `rgba(99, 102, 241, 0.4)` | Focus outline colour |

### Dark Theme Example

```css
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
}
```

```vue
<div :class="{ 'dark-theme': isDark }">
  <CliveEdit v-model="content" />
</div>
```

You can also use `@media (prefers-color-scheme: dark)` for automatic dark mode:

```css
@media (prefers-color-scheme: dark) {
  .cliveedit {
    --ce-bg: #1e1e1e;
    --ce-text: #d4d4d4;
    /* ... */
  }
}
```

---

## Vue Plugin (Global Registration)

Instead of importing `CliveEdit` in every component, you can register it globally:

```ts
// main.ts
import { createApp } from 'vue'
import { CliveEditPlugin } from '@dev_owl/cliveedit'
import '@dev_owl/cliveedit/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(CliveEditPlugin)
app.mount('#app')
```

Then use `<CliveEdit>` or `<MarkdownViewer>` anywhere without importing:

```vue
<template>
  <CliveEdit v-model="markdown" />
  <MarkdownViewer v-model="markdown" />
</template>
```

---

## Advanced Usage

### EditorContext (Provide / Inject)

CliveEdit provides an `EditorContext` object via Vue's provide/inject system. Child or descendant components can access the editor's commands and state:

```ts
import { inject } from 'vue'
import { EDITOR_CTX_KEY } from '@dev_owl/cliveedit'

const ctx = inject(EDITOR_CTX_KEY)

// Call formatting commands
ctx?.bold()
ctx?.heading(2)
ctx?.link('https://example.com', 'Example')
ctx?.table()  // Insert a 3×3 table

// Check state
ctx?.isActive('strong') // true if cursor is inside bold text
ctx?.isActive('table')  // true if cursor is inside a table
ctx?.canUndo            // true if undo is available
ctx?.mode               // 'wysiwyg' | 'markdown'

// Switch modes
ctx?.toggleMode()
```

#### EditorContext Interface

```ts
interface EditorContext {
  // State
  mode: EditorMode
  disabled: boolean

  // Formatting commands
  bold(): void
  italic(): void
  strikethrough(): void
  heading(level: 1 | 2 | 3): void
  bulletList(): void
  orderedList(): void
  blockquote(): void
  codeInline(): void
  codeBlock(): void
  link(url?: string, text?: string): void
  image(src?: string, alt?: string): void
  horizontalRule(): void
  table(): void

  // History
  undo(): void
  redo(): void
  canUndo: boolean
  canRedo: boolean

  // Mode
  toggleMode(): void

  // Query
  isActive(tag: string): boolean
}
```

### useHistory Composable

The undo/redo system is available as a standalone composable for headless or custom editor builds:

```ts
import { useHistory } from '@dev_owl/cliveedit'

const history = useHistory({ maxDepth: 50, debounceMs: 200 })

history.init('# Initial content')
history.pushState('# Updated content')    // debounced (for keystrokes)
history.pushImmediate('# After toolbar')  // immediate (for actions)

const prev = history.undo()   // returns HistoryEntry | null
const next = history.redo()   // returns HistoryEntry | null

history.canUndo.value  // boolean (computed ref)
history.canRedo.value  // boolean (computed ref)
```

| Method | Description |
|---|---|
| `init(markdown)` | Set the initial state. Clears all history. |
| `pushState(markdown)` | Debounced push — suited for continuous typing. |
| `pushImmediate(markdown)` | Immediate push — suited for toolbar actions, mode switches. |
| `undo()` | Returns the previous `HistoryEntry` or `null`. |
| `redo()` | Returns the next `HistoryEntry` or `null`. |
| `canUndo` | Computed ref — `true` when undo is available. |
| `canRedo` | Computed ref — `true` when redo is available. |
| `clear()` | Clear all history and cancel pending debounce. |

### useEditor Composable

The editor command layer is available standalone for building custom UIs around a `contenteditable` element:

```ts
import { ref } from 'vue'
import { useEditor } from '@dev_owl/cliveedit'

const editorEl = ref<HTMLElement | null>(null)
const editor = useEditor(editorEl)

// Formatting
editor.bold()
editor.italic()
editor.heading(2)
editor.link('https://example.com')

// State
editor.isActive('strong')  // boolean
editor.refreshActiveState()

// DOM access
editor.getHtml()
editor.setHtml('<p>Hello</p>')
editor.focus()
```

---

## TypeScript

All types are exported for full IntelliSense support:

```ts
import type {
  EditorMode,
  ToolbarItem,
  HistoryEntry,
  CliveEditProps,
  CliveEditEmits,
  EditorContext,
  MarkdownViewerProps,
} from '@dev_owl/cliveedit'
```

---

## Build Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `vite --config vite.dev.config.ts` | Start the development playground |
| `npm run build` | Type-check → Vite build → Generate `.d.ts` | Full production build |
| `npm run build:only` | `vite build` | Build without type-checking |
| `npm run typecheck` | `vue-tsc --noEmit` | Type-check only |

Build outputs in `dist/`:

| File | Format | Description |
|---|---|---|
| `cliveedit.es.js` | ESM | For modern bundlers (Vite, Webpack 5, Rollup) |
| `cliveedit.umd.js` | UMD | For script tags and legacy bundlers |
| `editor.css` | CSS | All editor styles (import as `@dev_owl/cliveedit/style.css`) |
| `*.d.ts` | TypeScript | Type declarations for all exports |

---

## Browser Support

CliveEdit uses standard DOM APIs (`contenteditable`, `Selection`, `Range`, `DOMParser`) and works in all modern browsers:

- Chrome / Edge 90+
- Firefox 90+
- Safari 15+

---

## License

MIT
