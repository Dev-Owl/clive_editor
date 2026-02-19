<template>
  <div class="cliveedit ce-editor-wrap" :class="{ 'ce-disabled': disabled }">
    <!-- Toolbar -->
    <EditorToolbar
      :mode="currentMode"
      :disabled="disabled"
      :custom-items="toolbarItems"
      :ctx="editorContext"
      @action="handleToolbarAction"
      @toggle-mode="toggleMode"
    />

    <!-- WYSIWYG Editor -->
    <WysiwygEditor
      v-show="currentMode === 'wysiwyg'"
      ref="wysiwygRef"
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @update:model-value="onContentUpdate"
      @input="onWysiwygInput"
      @selection-change="onSelectionChange"
    />

    <!-- Markdown Editor -->
    <MarkdownEditor
      v-show="currentMode === 'markdown'"
      ref="markdownRef"
      :model-value="modelValue"
      :placeholder="placeholder || 'Write markdown here...'"
      :disabled="disabled"
      @update:model-value="onContentUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, reactive, watch, onMounted, nextTick } from 'vue'
import WysiwygEditor from './WysiwygEditor.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import EditorToolbar from './EditorToolbar.vue'
import { useHistory } from '@/composables/useHistory'
import { useEditor } from '@/composables/useEditor'
import type {
  CliveEditProps,
  CliveEditEmits,
  EditorMode,
  EditorContext,
  ToolbarItem,
} from '@/types'
import { EDITOR_CTX_KEY } from '@/types'

/* ---- CSS imports ---- */
import '@/styles/variables.css'
import '@/styles/toolbar.css'
import '@/styles/editor.css'

/* ---- Props / Emits ---- */

const props = withDefaults(defineProps<CliveEditProps>(), {
  mode: 'wysiwyg',
  placeholder: 'Start writing...',
  disabled: false,
  historyDepth: 100,
})

const emit = defineEmits<CliveEditEmits>()

/* ---- Internal state ---- */

const currentMode = ref<EditorMode>(props.mode)
const wysiwygRef = ref<InstanceType<typeof WysiwygEditor> | null>(null)
const markdownRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

// Synthetic ref that points to the WYSIWYG contenteditable element
const wysiwygElRef = computed(() => wysiwygRef.value?.el ?? null)

/* ---- Composables ---- */

const history = useHistory({ maxDepth: props.historyDepth })
const editor = useEditor(wysiwygElRef as any)

/* ---- Watch mode prop (two-way) ---- */

watch(() => props.mode, (m) => {
  if (m !== currentMode.value) {
    currentMode.value = m
  }
})

/* ---- Initialise history ---- */

onMounted(() => {
  history.init(props.modelValue)
})

/* ---- Content updates ---- */

function onContentUpdate(md: string): void {
  emit('update:modelValue', md)
  history.pushState(md)
}

function onWysiwygInput(): void {
  // After user types, serialize from the WYSIWYG editor
  const md = wysiwygRef.value?.syncToMarkdown()
  if (md !== undefined && md !== props.modelValue) {
    emit('update:modelValue', md)
    history.pushState(md)
  }
}

function onSelectionChange(): void {
  editor.refreshActiveState()
}

/* ---- Mode toggle ---- */

function toggleMode(): void {
  // Save current state to history before switching
  history.pushImmediate(props.modelValue)

  if (currentMode.value === 'wysiwyg') {
    // Sync WYSIWYG → markdown before switching
    const md = wysiwygRef.value?.syncToMarkdown()
    if (md !== undefined && md !== props.modelValue) {
      emit('update:modelValue', md)
    }
    currentMode.value = 'markdown'
  } else {
    currentMode.value = 'wysiwyg'
    // Re-render the WYSIWYG from markdown after switching
    nextTick(() => {
      wysiwygRef.value?.refreshFromMarkdown()
    })
  }
  emit('update:mode', currentMode.value)
}

/* ---- Toolbar action dispatch ---- */

function handleToolbarAction(actionName: string): void {
  if (props.disabled) return

  // History: push immediate before destructive actions
  if (actionName !== 'undo' && actionName !== 'redo') {
    history.pushImmediate(props.modelValue)
  }

  if (currentMode.value === 'wysiwyg') {
    handleWysiwygAction(actionName)
  } else {
    handleMarkdownAction(actionName)
  }
}

function handleWysiwygAction(action: string): void {
  switch (action) {
    case 'bold': editor.bold(); break
    case 'italic': editor.italic(); break
    case 'strikethrough': editor.strikethrough(); break
    case 'heading1': editor.heading(1); break
    case 'heading2': editor.heading(2); break
    case 'heading3': editor.heading(3); break
    case 'bulletList': editor.bulletList(); break
    case 'orderedList': editor.orderedList(); break
    case 'blockquote': editor.blockquote(); break
    case 'codeInline': editor.codeInline(); break
    case 'codeBlock': editor.codeBlock(); break
    case 'link': editor.link(); break
    case 'image': editor.image(); break
    case 'horizontalRule': editor.horizontalRule(); break
    case 'table': editor.table(); break
    case 'undo': doUndo(); return
    case 'redo': doRedo(); return
    default: return
  }

  // After action, sync to markdown
  nextTick(() => {
    const md = wysiwygRef.value?.syncToMarkdown()
    if (md !== undefined) {
      emit('update:modelValue', md)
      history.pushImmediate(md)
    }
  })
}

function handleMarkdownAction(action: string): void {
  const md = markdownRef.value
  if (!md) return

  switch (action) {
    case 'bold': md.insertSyntax('**', '**'); break
    case 'italic': md.insertSyntax('*', '*'); break
    case 'strikethrough': md.insertSyntax('~~', '~~'); break
    case 'heading1': md.insertSyntax('# ', ''); break
    case 'heading2': md.insertSyntax('## ', ''); break
    case 'heading3': md.insertSyntax('### ', ''); break
    case 'bulletList': md.insertSyntax('- ', ''); break
    case 'orderedList': md.insertSyntax('1. ', ''); break
    case 'blockquote': md.insertSyntax('> ', ''); break
    case 'codeInline': md.insertSyntax('`', '`'); break
    case 'codeBlock': md.insertBlock('\n```\n\n```\n'); break
    case 'link': md.insertSyntax('[', '](url)'); break
    case 'image': md.insertSyntax('![alt](', ')'); break
    case 'horizontalRule': md.insertBlock('\n---\n'); break
    case 'table': md.insertBlock('\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |\n'); break
    case 'undo': doUndo(); break
    case 'redo': doRedo(); break
  }
}

/* ---- Undo / Redo ---- */

function doUndo(): void {
  const entry = history.undo()
  if (!entry) return
  emit('update:modelValue', entry.markdown)
  if (currentMode.value === 'wysiwyg') {
    nextTick(() => wysiwygRef.value?.refreshFromMarkdown())
  }
}

function doRedo(): void {
  const entry = history.redo()
  if (!entry) return
  emit('update:modelValue', entry.markdown)
  if (currentMode.value === 'wysiwyg') {
    nextTick(() => wysiwygRef.value?.refreshFromMarkdown())
  }
}

/* ---- Keyboard shortcuts (captured at root level) ---- */

function onRootKeydown(e: KeyboardEvent): void {
  if (props.disabled) return
  const mod = e.ctrlKey || e.metaKey

  if (mod && e.key === 'b') {
    e.preventDefault()
    handleToolbarAction('bold')
  } else if (mod && e.key === 'i') {
    e.preventDefault()
    handleToolbarAction('italic')
  } else if (mod && e.key === 'k') {
    e.preventDefault()
    handleToolbarAction('link')
  } else if (mod && e.shiftKey && e.key === 'z') {
    e.preventDefault()
    doRedo()
  } else if (mod && e.key === 'z') {
    e.preventDefault()
    doUndo()
  }
}

/* ---- Editor Context (provide/inject) ---- */

const editorContext = reactive<EditorContext>({
  mode: currentMode.value,
  disabled: props.disabled,
  bold: () => handleToolbarAction('bold'),
  italic: () => handleToolbarAction('italic'),
  strikethrough: () => handleToolbarAction('strikethrough'),
  heading: (level: 1 | 2 | 3) => handleToolbarAction(`heading${level}`),
  bulletList: () => handleToolbarAction('bulletList'),
  orderedList: () => handleToolbarAction('orderedList'),
  blockquote: () => handleToolbarAction('blockquote'),
  codeInline: () => handleToolbarAction('codeInline'),
  codeBlock: () => handleToolbarAction('codeBlock'),
  link: () => handleToolbarAction('link'),
  image: () => handleToolbarAction('image'),
  horizontalRule: () => handleToolbarAction('horizontalRule'),
  table: () => handleToolbarAction('table'),
  undo: doUndo,
  redo: doRedo,
  canUndo: history.canUndo.value,
  canRedo: history.canRedo.value,
  toggleMode,
  isActive: (tag: string) => editor.isActive(tag),
})

// Keep context in sync
watch(currentMode, (m) => { editorContext.mode = m })
watch(() => props.disabled, (d) => { editorContext.disabled = d })
watch(history.canUndo, (v) => { editorContext.canUndo = v })
watch(history.canRedo, (v) => { editorContext.canRedo = v })

provide(EDITOR_CTX_KEY, editorContext)

/* ---- Public API ---- */

defineExpose({
  /** Get the current markdown content */
  getMarkdown: () => props.modelValue,
  /** Get the current mode */
  getMode: () => currentMode.value,
  /** Programmatic undo */
  undo: doUndo,
  /** Programmatic redo */
  redo: doRedo,
  /** Focus the active editor */
  focus: () => {
    if (currentMode.value === 'wysiwyg') {
      wysiwygRef.value?.focus()
    } else {
      markdownRef.value?.focus()
    }
  },
})
</script>

<script lang="ts">
export default {
  name: 'CliveEdit',
  inheritAttrs: false,
}
</script>
