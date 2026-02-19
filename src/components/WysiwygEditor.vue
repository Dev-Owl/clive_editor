<template>
  <div class="ce-wysiwyg-wrap">
    <TableControls
      :editor-el="editorEl"
      :disabled="disabled"
      @change="onInput"
    />
    <div
      ref="editorEl"
      class="ce-wysiwyg"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :aria-label="placeholder || 'Rich text editor'"
      :data-placeholder="placeholder"
      spellcheck="true"
      @input="onInput"
      @keydown="onKeydown"
      @keyup="onSelectionChange"
      @paste="onPaste"
      @click="onClick"
      @mouseup="onSelectionChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { sanitizeHtml } from '@/utils/sanitize'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'
import {
  findClosestCell,
  isSelectionCrossCell,
  handleCrossCellDelete,
  getAdjacentCell,
} from '@/utils/selection'
import TableControls from './TableControls.vue'

/* ---- Props / Emits ---- */

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: []
  selectionChange: []
}>()

/* ---- Refs ---- */

const editorEl = ref<HTMLElement | null>(null)
let isSyncing = false

/* ---- Expose ---- */

defineExpose({
  /** Direct ref to the contenteditable element */
  el: editorEl,
  /** Get current HTML */
  getHtml: () => editorEl.value?.innerHTML ?? '',
  /** Set HTML content */
  setHtml: (html: string) => {
    if (editorEl.value) {
      isSyncing = true
      editorEl.value.innerHTML = html
      isSyncing = false
    }
  },
  /** Sync HTML → markdown and return the markdown */
  syncToMarkdown: (): string => {
    if (!editorEl.value) return props.modelValue
    return serializeHtml(editorEl.value.innerHTML)
  },
  /** Re-render from current modelValue */
  refreshFromMarkdown: () => {
    if (!editorEl.value) return
    isSyncing = true
    editorEl.value.innerHTML = parseMarkdown(props.modelValue)
    isSyncing = false
  },
  /** Focus the editor */
  focus: () => editorEl.value?.focus(),
})

/* ---- Lifecycle ---- */

onMounted(() => {
  if (editorEl.value && props.modelValue) {
    editorEl.value.innerHTML = parseMarkdown(props.modelValue)
  }
  // Listen for modifier keys to show clickable-link cursor hint
  window.addEventListener('keydown', onModifierDown)
  window.addEventListener('keyup', onModifierUp)
  window.addEventListener('blur', onModifierUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onModifierDown)
  window.removeEventListener('keyup', onModifierUp)
  window.removeEventListener('blur', onModifierUp)
})

function onModifierDown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && editorEl.value) {
    editorEl.value.classList.add('ce-links-clickable')
  }
}
function onModifierUp(e?: KeyboardEvent | Event): void {
  editorEl.value?.classList.remove('ce-links-clickable')
}

/* ---- Watch external modelValue changes ---- */

watch(
  () => props.modelValue,
  (md) => {
    if (isSyncing) return
    if (!editorEl.value) return
    // Only update if content actually differs (prevent cursor jump)
    const currentMd = serializeHtml(editorEl.value.innerHTML)
    if (currentMd !== md) {
      isSyncing = true
      editorEl.value.innerHTML = parseMarkdown(md)
      isSyncing = false
    }
  },
)

/* ---- Event handlers ---- */

let inputTimer: ReturnType<typeof setTimeout> | null = null

function onInput(): void {
  if (isSyncing) return
  emit('input')

  // Debounced emit of markdown value
  if (inputTimer) clearTimeout(inputTimer)
  inputTimer = setTimeout(() => {
    if (!editorEl.value) return
    isSyncing = true
    const md = serializeHtml(editorEl.value.innerHTML)
    emit('update:modelValue', md)
    isSyncing = false
  }, 100)
}

function onKeydown(e: KeyboardEvent): void {
  if (props.disabled) {
    e.preventDefault()
    return
  }

  const mod = e.ctrlKey || e.metaKey
  const sel = window.getSelection()
  // ---- Table cell navigation ----
  // Find the active cell.  Use the Range's endContainer (document order) as well
  // as anchorNode, because for right-to-left selections the anchorNode is at
  // the right side (reliable) but the startContainer can be at a TR boundary.
  // endContainer is always inside the "real" cell the user is working in.
  let cell: HTMLTableCellElement | null = null
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0)
    cell = findClosestCell(r.endContainer) ?? findClosestCell(r.startContainer) ?? findClosestCell(sel.anchorNode, sel.anchorOffset)
  }
  if (cell) {
    // Tab / Shift+Tab → move between cells
    if (e.key === 'Tab') {
      e.preventDefault()
      const adjacent = getAdjacentCell(cell, e.shiftKey ? 'prev' : 'next')
      if (adjacent && sel) {
        const newRange = document.createRange()
        newRange.selectNodeContents(adjacent)
        sel.removeAllRanges()
        sel.addRange(newRange)
      }
      return
    }

    // Enter inside a table cell → insert <br> instead of new block
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const br = document.createElement('br')
        range.insertNode(br)
        range.setStartAfter(br)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
      onInput()
      return
    }

    // ---- Single-cell selection guard ----
    // When text is selected within a single cell, the browser's default
    // contenteditable can misplace text outside the cell or corrupt
    // adjacent cells.  For right-to-left selections the browser Range can
    // physically start at the <tr> boundary (the previous cell) even though
    // only one cell appears highlighted.  Instead of trying to clamp and use
    // the browser Range, we work entirely with the cell DOM directly.
    if (sel && !sel.isCollapsed) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        // Build a range that covers only this cell's content
        const safeRange = document.createRange()
        safeRange.selectNodeContents(cell)
        // Adjust to preserve any content before/after the user's visual selection
        // by intersecting with the original range
        const origRange = sel.getRangeAt(0)
        // Use the later start and the earlier end
        if (cell.contains(origRange.startContainer) &&
            safeRange.compareBoundaryPoints(Range.START_TO_START, origRange) < 0) {
          safeRange.setStart(origRange.startContainer, origRange.startOffset)
        }
        if (cell.contains(origRange.endContainer) &&
            safeRange.compareBoundaryPoints(Range.END_TO_END, origRange) > 0) {
          safeRange.setEnd(origRange.endContainer, origRange.endOffset)
        }
        sel.removeAllRanges()
        sel.addRange(safeRange)
        safeRange.deleteContents()
        // Place cursor inside the cell
        const cursor = document.createRange()
        cursor.selectNodeContents(cell)
        cursor.collapse(true)
        sel.removeAllRanges()
        sel.addRange(cursor)
        onInput()
        return
      }

      // Printable character with selection → replace selected text safely
      if (e.key.length === 1 && !mod) {
        e.preventDefault()
        // Same safe-range approach as above
        const safeRange = document.createRange()
        safeRange.selectNodeContents(cell)
        const origRange = sel.getRangeAt(0)
        if (cell.contains(origRange.startContainer) &&
            safeRange.compareBoundaryPoints(Range.START_TO_START, origRange) < 0) {
          safeRange.setStart(origRange.startContainer, origRange.startOffset)
        }
        if (cell.contains(origRange.endContainer) &&
            safeRange.compareBoundaryPoints(Range.END_TO_END, origRange) > 0) {
          safeRange.setEnd(origRange.endContainer, origRange.endOffset)
        }
        sel.removeAllRanges()
        sel.addRange(safeRange)
        safeRange.deleteContents()
        // Insert the typed character
        const text = document.createTextNode(e.key)
        cell.appendChild(text)
        const cursor = document.createRange()
        cursor.setStartAfter(text)
        cursor.collapse(true)
        sel.removeAllRanges()
        sel.addRange(cursor)
        onInput()
        return
      }
    }
  }

  // Prevent default browser Ctrl+B/I (they use execCommand)
  // — the toolbar / parent will handle these via its own shortcut system
  if (mod && (e.key === 'b' || e.key === 'i')) {
    // Don't prevent — let the event bubble to the parent CliveEdit
    // which will call the appropriate editor command
  }
}

/* ---- Ctrl+Click to open links ---- */

function onClick(e: MouseEvent): void {
  if (!(e.ctrlKey || e.metaKey)) return

  const target = e.target as HTMLElement
  const anchor = target.closest('a') as HTMLAnchorElement | null
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href) return

  e.preventDefault()
  e.stopPropagation()
  window.open(href, '_blank', 'noopener,noreferrer')
}

/* ---- Paste handler ---- */

function onPaste(e: ClipboardEvent): void {
  e.preventDefault()
  const html = e.clipboardData?.getData('text/html')
  const text = e.clipboardData?.getData('text/plain') ?? ''

  let cleanHtml: string
  if (html) {
    cleanHtml = sanitizeHtml(html)
  } else {
    // Plain text — convert newlines to <br>
    cleanHtml = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  }

  // Insert at cursor
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  range.deleteContents()

  const temp = document.createElement('div')
  temp.innerHTML = cleanHtml
  const frag = document.createDocumentFragment()
  let lastNode: Node | null = null
  while (temp.firstChild) {
    lastNode = frag.appendChild(temp.firstChild)
  }
  range.insertNode(frag)

  // Move cursor after pasted content
  if (lastNode) {
    const newRange = document.createRange()
    newRange.setStartAfter(lastNode)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }

  // Trigger sync
  onInput()
}

function onSelectionChange(): void {
  emit('selectionChange')
}
</script>
