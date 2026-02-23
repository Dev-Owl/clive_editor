<template>
  <div class="ce-wysiwyg-wrap">
    <TableControls :editor-el="editorEl" :disabled="disabled" @change="onInput" />
    <div ref="editorEl" class="ce-wysiwyg" contenteditable="true" role="textbox" aria-multiline="true"
      :aria-label="placeholder || 'Rich text editor'" :data-placeholder="placeholder" spellcheck="true" @input="onInput"
      @keydown="onKeydown" @keyup="onSelectionChange" @paste="onPaste" @click="onClick" @mouseup="onSelectionChange" />
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
  isInsideTag,
} from '@/utils/selection'
import TableControls from './TableControls.vue'

/* ---- Props / Emits ---- */

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  /** Optional highlight function for syntax highlighting code blocks */
  highlight?: (code: string, lang: string) => string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: []
  selectionChange: []
  action: [actionName: string]
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
    editorEl.value.innerHTML = parseMarkdown(props.modelValue, {
      highlight: props.highlight,
    })
    isSyncing = false
  },
  /** Focus the editor */
  focus: () => editorEl.value?.focus(),
})

/* ---- Lifecycle ---- */

onMounted(() => {
  if (editorEl.value && props.modelValue) {
    editorEl.value.innerHTML = parseMarkdown(props.modelValue, {
      highlight: props.highlight,
    })
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
      editorEl.value.innerHTML = parseMarkdown(md, {
        highlight: props.highlight,
      })
      isSyncing = false
    }
  },
)

/* ---- Event handlers ---- */

let inputTimer: ReturnType<typeof setTimeout> | null = null

function onInput(): void {
  if (isSyncing) return
  emit('input')

  // Debounced re-highlight of the current code block
  if (props.highlight) {
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => {
      rehighlightCurrentBlock()
    }, 300)
  }

  // Repair any <pre> blocks where the browser removed the <code> element
  // (happens when the user deletes all content — the lang label div keeps
  // the <pre> alive visually but <code> is gone).
  if (editorEl.value) {
    for (const pre of editorEl.value.querySelectorAll('pre')) {
      if (!pre.querySelector('code')) {
        const labelEl = pre.querySelector('.ce-code-lang')
        const lang = (labelEl as HTMLElement)?.dataset?.lang ?? ''
        const codeEl = document.createElement('code')
        if (lang) codeEl.className = `language-${lang}`
        codeEl.appendChild(document.createTextNode(''))
        pre.appendChild(codeEl)
        // Place cursor inside the restored <code>
        const sel = window.getSelection()
        if (sel) {
          const range = document.createRange()
          range.selectNodeContents(codeEl)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
    }
  }

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

  // ---- Tab / Shift+Tab inside a list → indent / outdent ----
  if (e.key === 'Tab' && sel && sel.rangeCount > 0) {
    if (isInsideTag('li')) {
      e.preventDefault()
      emit('action', e.shiftKey ? 'outdentList' : 'indentList')
      return
    }
  }

  // ---- Enter inside an inline <code> → move out of the code element first ----
  if (e.key === 'Enter' && !mod && sel && sel.rangeCount > 0) {
    const anchor = sel.anchorNode
    const codeEl = anchor instanceof HTMLElement
      ? anchor.closest('code')
      : anchor?.parentElement?.closest('code')
    // Only handle inline <code> (not code inside a <pre> block)
    if (codeEl && !codeEl.closest('pre') && editorEl.value?.contains(codeEl)) {
      e.preventDefault()
      // Move cursor to just after the <code> element, then insert a new paragraph
      const range = document.createRange()
      range.setStartAfter(codeEl)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      // Insert a line break to create a new block after the code
      const br = document.createElement('br')
      range.insertNode(br)
      range.setStartAfter(br)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      onInput()
      return
    }
  }

  // ---- Enter inside a <pre> code block → insert newline, don't split ----
  if (e.key === 'Enter' && !mod && sel && sel.rangeCount > 0) {
    const anchor = sel.anchorNode
    const preEl = anchor instanceof HTMLElement
      ? anchor.closest('pre')
      : anchor?.parentElement?.closest('pre')
    if (preEl && editorEl.value?.contains(preEl)) {
      e.preventDefault()
      const range = sel.getRangeAt(0)
      range.deleteContents()
      // Insert a plain newline character (preserves <pre> formatting)
      const nl = document.createTextNode('\n')
      range.insertNode(nl)
      range.setStartAfter(nl)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      onInput()
      return
    }
  }

  // Prevent default browser Ctrl+B/I (they use execCommand)
  // — the toolbar / parent will handle these via its own shortcut system
  if (mod && (e.key === 'b' || e.key === 'i')) {
    // Don't prevent — let the event bubble to the parent CliveEdit
    // which will call the appropriate editor command
  }
}

/* ---- Ctrl+Click to open links & language label editing ---- */

let activeLangInput: HTMLInputElement | null = null

function onClick(e: MouseEvent): void {
  // ---- Language label click → show inline input ----
  const target = e.target as HTMLElement
  if (target.classList?.contains('ce-code-lang')) {
    e.preventDefault()
    e.stopPropagation()
    showLangInput(target)
    return
  }

  if (!(e.ctrlKey || e.metaKey)) return

  const anchor = target.closest('a') as HTMLAnchorElement | null
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href) return

  e.preventDefault()
  e.stopPropagation()
  window.open(href, '_blank', 'noopener,noreferrer')
}

/**
 * Show an inline <input> over the language label to let the user
 * type a language identifier. On confirm (Enter / blur) the code
 * block is re-highlighted.
 */
function showLangInput(labelEl: HTMLElement): void {
  // Clean up any existing input
  if (activeLangInput) {
    activeLangInput.remove()
    activeLangInput = null
  }

  const preEl = labelEl.closest('pre')
  if (!preEl) return

  const currentLang = labelEl.getAttribute('data-lang') || ''

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'ce-code-lang-input'
  input.value = currentLang === '' ? '' : currentLang
  input.placeholder = 'language'
  input.setAttribute('spellcheck', 'false')
  input.setAttribute('autocomplete', 'off')

  // Position over the label
  labelEl.style.visibility = 'hidden'
  labelEl.insertAdjacentElement('afterend', input)
  activeLangInput = input

  input.focus()
  input.select()

  function commitLang(): void {
    const newLang = input.value.trim().toLowerCase()
    labelEl.style.visibility = ''
    input.remove()
    activeLangInput = null

    // Update the label
    labelEl.textContent = newLang || 'plain text'
    labelEl.setAttribute('data-lang', newLang)

    // Update the <code> element class
    const codeEl = preEl!.querySelector('code')
    if (codeEl) {
      codeEl.className = newLang ? `language-${newLang}` : ''

      // Re-highlight the code block if a highlight function is provided
      if (props.highlight && newLang) {
        const rawCode = codeEl.textContent || ''
        const highlighted = props.highlight(rawCode, newLang)
        if (highlighted) {
          // Shiki returns <pre><code>…</code></pre>, extract the inner HTML
          const match = highlighted.match(/<code[^>]*>([\s\S]*)<\/code>/)
          if (match) {
            codeEl.innerHTML = match[1]
          }
        }
      } else {
        // No highlighting — ensure we show plain text
        const rawCode = codeEl.textContent || ''
        codeEl.textContent = rawCode
      }
    }

    // Trigger serialization
    onInput()
  }

  input.addEventListener('blur', commitLang, { once: true })
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      input.blur()
    } else if (ev.key === 'Escape') {
      ev.preventDefault()
      labelEl.style.visibility = ''
      input.remove()
      activeLangInput = null
    }
  })
}

/* ---- Re-highlight code blocks on edit ---- */

let highlightTimer: ReturnType<typeof setTimeout> | null = null

function rehighlightCurrentBlock(): void {
  if (!props.highlight || !editorEl.value) return

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  // Check if cursor is inside a <pre>
  let node: Node | null = sel.anchorNode
  let preEl: HTMLPreElement | null = null
  while (node && node !== editorEl.value) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'PRE') {
      preEl = node as HTMLPreElement
      break
    }
    node = node.parentNode
  }
  if (!preEl) return

  const codeEl = preEl.querySelector('code')
  if (!codeEl) return

  const langMatch = (codeEl.className || '').match(/language-(\S+)/)
  const lang = langMatch ? langMatch[1] : ''
  if (!lang) return

  const rawCode = codeEl.textContent || ''
  const highlighted = props.highlight(rawCode, lang)
  if (!highlighted) return

  // Extract the inner <code> HTML from Shiki output
  const match = highlighted.match(/<code[^>]*>([\s\S]*)<\/code>/)
  if (!match) return

  // Save cursor offset relative to the code element's text content
  const range = sel.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(codeEl)
  preCaretRange.setEnd(range.startContainer, range.startOffset)
  const caretOffset = preCaretRange.toString().length

  // Replace HTML
  codeEl.innerHTML = match[1]

  // Restore cursor position
  restoreCursorInCode(codeEl, caretOffset, sel)
}

/**
 * Walk through text nodes in `codeEl` to place the cursor at
 * the character offset `caretOffset`.
 */
function restoreCursorInCode(
  codeEl: HTMLElement,
  caretOffset: number,
  sel: Selection,
): void {
  const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT)
  let remaining = caretOffset
  let textNode: Text | null = null

  while (walker.nextNode()) {
    const tn = walker.currentNode as Text
    if (remaining <= tn.length) {
      textNode = tn
      break
    }
    remaining -= tn.length
  }

  if (textNode) {
    const newRange = document.createRange()
    newRange.setStart(textNode, remaining)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }
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
