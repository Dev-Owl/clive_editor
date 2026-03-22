<template>
  <div class="cliveedit ce-editor-wrap"
    :class="{ 'ce-disabled': disabled, 'ce-editor-wrap--sticky': stickyToolbar !== false }" @keydown="onRootKeydown">
    <!-- Toolbar -->
    <EditorToolbar :mode="currentMode" :disabled="disabled" :custom-items="toolbarItems" :ctx="editorContext"
      :enable-emoji="emojiPickerComposable.isReady.value && emojiPickerComposable.enabled.value"
      @action="handleToolbarAction" @toggle-mode="toggleMode" />

    <!-- WYSIWYG Editor -->
    <WysiwygEditor v-show="currentMode === 'wysiwyg'" ref="wysiwygRef" :model-value="modelValue"
      :placeholder="placeholder" :disabled="disabled" :highlight="highlightFn ?? undefined"
      :on-image-upload="onImageUpload" :max-image-size="maxImageSize" @update:model-value="onContentUpdate"
      @input="onWysiwygInput" @selection-change="onSelectionChange" @action="handleToolbarAction" />

    <!-- Markdown Editor -->
    <MarkdownEditor v-show="currentMode === 'markdown'" ref="markdownRef" :model-value="modelValue"
      :placeholder="placeholder || 'Write markdown here...'" :disabled="disabled"
      @update:model-value="onContentUpdate" />

    <!-- Emoji Picker (floating panel — teleported to body to escape overflow clipping) -->
    <Teleport to="body">
      <EmojiPicker
        :visible="emojiPickerVisible"
        :anchor-el="emojiAnchorEl"
        :options="emojiPickerOptions"
        @select="onEmojiSelect"
        @close="emojiPickerVisible = false"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, reactive, watch, onMounted, nextTick } from 'vue'
import WysiwygEditor from './WysiwygEditor.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import EditorToolbar from './EditorToolbar.vue'
import EmojiPicker from './EmojiPicker.vue'
import { useHistory } from '@/composables/useHistory'
import { useEditor } from '@/composables/useEditor'
import { useHighlighter } from '@/composables/useHighlighter'
import { useEmojiPicker } from '@/composables/useEmojiPicker'
import { getHeadingAction, runMarkdownCommand, runWysiwygCommand } from '@/commands'
import { parseMarkdown } from '@/utils/markdown'
import { insertHtmlAtCursor, saveSelection, restoreSelection } from '@/utils/selection'
import type { SavedSelection } from '@/utils/selection'
import type {
  CliveEditProps,
  CliveEditEmits,
  EditorMode,
  EditorContext,
  ToolbarAction,
  ToolbarItem,
  EmojiPickerOptions,
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
  stickyToolbar: true,
})

const emit = defineEmits<CliveEditEmits>()

/* ---- Internal state ---- */

const currentMode = ref<EditorMode>(props.mode)
const wysiwygRef = ref<InstanceType<typeof WysiwygEditor> | null>(null)
const markdownRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
let pendingImmediateMarkdownHistory = false

// Synthetic ref that points to the WYSIWYG contenteditable element
const wysiwygElRef = computed(() => wysiwygRef.value?.el ?? null)

/* ---- Composables ---- */

const history = useHistory({ maxDepth: props.historyDepth })
const editor = useEditor(wysiwygElRef as any)
const {
  init: initHighlight,
  highlight,
  isReady: highlightReady,
  enabled: highlightEnabled,
  highlightFn,
  setEnabled: setHighlightEnabled,
  setDarkMode: setHighlightDarkMode,
  provideHighlight,
} = useHighlighter()

// Provide the highlight function to child components (e.g. MarkdownViewer)
provideHighlight()

const emojiPickerComposable = useEmojiPicker()

/* ---- Emoji picker state ---- */

const emojiPickerVisible = ref(false)
const emojiAnchorEl = ref<HTMLElement | null>(null)
let emojiSavedSelection: SavedSelection | null = null
let lastWysiwygSelection: SavedSelection | null = null

const emojiPickerOptions = computed<EmojiPickerOptions | undefined>(() => {
  const opt = props.emojiPicker
  if (!opt) return undefined
  if (opt === true) return {}
  return opt
})

/* ---- Watch mode prop (two-way) ---- */

watch(() => props.mode, (m) => {
  if (m !== currentMode.value) {
    currentMode.value = m
  }
})

/* ---- Initialise history ---- */

onMounted(() => {
  history.init(props.modelValue)

  // Initialise Shiki if highlightOptions are provided
  if (props.highlightOptions) {
    initHighlight(props.highlightOptions).then((ok) => {
      if (ok && currentMode.value === 'wysiwyg') {
        // Re-render WYSIWYG with highlighting now that Shiki is loaded
        nextTick(() => wysiwygRef.value?.refreshFromMarkdown())
      }
    })
  }

  // Initialise emoji picker if emojiPicker prop is provided
  if (props.emojiPicker) {
    const opts = props.emojiPicker === true ? {} : props.emojiPicker
    emojiPickerComposable.init(opts)
  }
})

/* ---- Watch highlightOptions prop ---- */

watch(
  () => props.highlightOptions,
  (opts) => {
    if (opts) {
      // Ensure Shiki is initialised, then enable highlighting
      if (!highlightReady.value) {
        initHighlight(opts).then((ok) => {
          if (ok) {
            setHighlightDarkMode(!!opts.darkMode)
            nextTick(() => wysiwygRef.value?.refreshFromMarkdown())
          }
        })
      } else {
        setHighlightEnabled(true)
        setHighlightDarkMode(!!opts.darkMode)
        nextTick(() => wysiwygRef.value?.refreshFromMarkdown())
      }
    } else {
      // highlightOptions removed → disable highlighting
      setHighlightEnabled(false)
      nextTick(() => wysiwygRef.value?.refreshFromMarkdown())
    }
  },
  { deep: true },
)

/* ---- Watch emojiPicker prop ---- */

watch(
  () => props.emojiPicker,
  (opt) => {
    if (opt) {
      const opts = opt === true ? {} : opt
      if (!emojiPickerComposable.isReady.value) {
        emojiPickerComposable.init(opts)
      } else {
        emojiPickerComposable.setEnabled(true)
      }
    } else {
      emojiPickerComposable.setEnabled(false)
      emojiPickerVisible.value = false
    }
  },
  { deep: true },
)

/* ---- Content updates ---- */

function onContentUpdate(md: string): void {
  emit('update:modelValue', md)
  if (pendingImmediateMarkdownHistory) {
    pendingImmediateMarkdownHistory = false
    history.pushImmediate(md)
  } else {
    history.pushState(md)
  }
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
  lastWysiwygSelection = saveSelection()
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

function createContextAction(action: ToolbarAction): () => void {
  return () => handleToolbarAction(action)
}

function syncWysiwygToMarkdown(): void {
  nextTick(() => {
    const md = wysiwygRef.value?.syncToMarkdown()
    if (md !== undefined) {
      emit('update:modelValue', md)
      history.pushImmediate(md)
    }
  })
}

function restoreWysiwygSelection(): void {
  if (!lastWysiwygSelection) return
  wysiwygRef.value?.focus()
  restoreSelection(lastWysiwygSelection)
}

function renderMarkdownInsertion(markdown: string): string {
  const container = document.createElement('div')
  container.innerHTML = parseMarkdown(markdown, {
    highlight: highlightFn.value ?? undefined,
  })

  if (container.children.length === 1 && container.firstElementChild?.tagName === 'P') {
    return (container.firstElementChild as HTMLElement).innerHTML
  }

  return container.innerHTML
}

function handleToolbarAction(actionName: ToolbarAction): void {
  if (props.disabled) return

  // Emoji action is handled separately (toggle picker)
  if (actionName === 'emoji') {
    toggleEmojiPicker()
    return
  }

  // History: push immediate before destructive actions
  if (actionName !== 'undo' && actionName !== 'redo') {
    history.pushImmediate(props.modelValue)
  }

  if (currentMode.value === 'wysiwyg') {
    const executed = runWysiwygCommand(
      {
        ...editor,
        undo: doUndo,
        redo: doRedo,
      },
      actionName,
    )
    if (executed && actionName !== 'undo' && actionName !== 'redo') {
      syncWysiwygToMarkdown()
    }
  } else {
    const md = markdownRef.value
    if (md) {
      pendingImmediateMarkdownHistory = true
      runMarkdownCommand(md, actionName)
    }
  }
}

/* ---- Emoji picker ---- */

function toggleEmojiPicker(): void {
  if (emojiPickerVisible.value) {
    emojiPickerVisible.value = false
    return
  }
  // Save the current selection so we can restore it before inserting
  if (currentMode.value === 'wysiwyg') {
    emojiSavedSelection = saveSelection()
  }
  // Find the emoji toolbar button to anchor the picker
  const toolbar = document.querySelector('.cliveedit .ce-toolbar')
  const btn = toolbar?.querySelector<HTMLElement>('[aria-label="Emoji"]')
  emojiAnchorEl.value = btn ?? null
  emojiPickerVisible.value = true
}

function onEmojiSelect(unicode: string): void {
  emojiPickerVisible.value = false
  history.pushImmediate(props.modelValue)

  if (currentMode.value === 'wysiwyg') {
    // Restore saved cursor position and insert the emoji character
    if (emojiSavedSelection) {
      restoreSelection(emojiSavedSelection)
      emojiSavedSelection = null
    }
    // Insert as a plain text character (like typing it)
    document.execCommand('insertText', false, unicode)
    // Sync to markdown
    nextTick(() => {
      const md = wysiwygRef.value?.syncToMarkdown()
      if (md !== undefined) {
        emit('update:modelValue', md)
        history.pushImmediate(md)
      }
    })
  } else {
    // Markdown mode — insert at textarea cursor
    pendingImmediateMarkdownHistory = true
    markdownRef.value?.insertBlock(unicode)
  }
}

function insertTextAtCursor(text: string): void {
  if (!text) return

  history.pushImmediate(props.modelValue)

  if (currentMode.value === 'wysiwyg') {
    restoreWysiwygSelection()
    document.execCommand('insertText', false, text)
    syncWysiwygToMarkdown()
  } else {
    pendingImmediateMarkdownHistory = true
    markdownRef.value?.insertBlock(text)
  }
}

function insertMarkdownAtCursor(markdown: string): void {
  if (!markdown) return

  history.pushImmediate(props.modelValue)

  if (currentMode.value === 'wysiwyg') {
    restoreWysiwygSelection()
    insertHtmlAtCursor(renderMarkdownInsertion(markdown))
    syncWysiwygToMarkdown()
  } else {
    pendingImmediateMarkdownHistory = true
    markdownRef.value?.insertBlock(markdown)
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
  } else if (mod && e.shiftKey && e.key.toLocaleLowerCase() === 'z') {
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
  bold: createContextAction('bold'),
  italic: createContextAction('italic'),
  strikethrough: createContextAction('strikethrough'),
  heading: (level: 1 | 2 | 3) => handleToolbarAction(getHeadingAction(level)),
  bulletList: createContextAction('bulletList'),
  orderedList: createContextAction('orderedList'),
  indentList: createContextAction('indentList'),
  outdentList: createContextAction('outdentList'),
  blockquote: createContextAction('blockquote'),
  codeInline: createContextAction('codeInline'),
  codeBlock: createContextAction('codeBlock'),
  link: createContextAction('link'),
  image: createContextAction('image'),
  horizontalRule: createContextAction('horizontalRule'),
  table: createContextAction('table'),
  emoji: createContextAction('emoji'),
  insertText: insertTextAtCursor,
  insertMarkdown: insertMarkdownAtCursor,
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
