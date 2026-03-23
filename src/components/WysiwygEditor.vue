<template>
  <div class="ce-wysiwyg-wrap">
    <TableControls :editor-el="editorEl" :disabled="disabled" @change="onInput" />
    <div ref="editorEl" class="ce-wysiwyg" contenteditable="true" role="textbox" aria-multiline="true"
      :aria-label="placeholder || 'Rich text editor'" :data-placeholder="placeholder" spellcheck="true" @input="onInput($event)"
      @keydown="onKeydown" @keyup="onSelectionChange" @paste="onPaste" @drop="onDrop" @dragover.prevent @click="onClick"
      @mouseup="onSelectionChange" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { sanitizeHtml } from '@/utils/sanitize'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'
import type { ToolbarAction } from '@/types'
import {
  findClosestCell,
  isSelectionCrossCell,
  handleCrossCellDelete,
  getAdjacentCell,
  isInsideTag,
} from '@/utils/selection'
import TableControls from './TableControls.vue'

/* ---- Props / Emits ---- */

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const DEFAULT_MAX_IMAGE_SIZE = 2_097_152 // 2 MB

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  /** Optional highlight function for syntax highlighting code blocks */
  highlight?: (code: string, lang: string) => string
  /** Called when an image is pasted or dropped. Return a URL string. */
  onImageUpload?: (file: File) => Promise<string>
  /** Max image file size in bytes (default: 2 MB) */
  maxImageSize?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: []
  selectionChange: []
  action: [actionName: ToolbarAction]
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
type CellBoundaryPoint = { node: Node, offset: number, range: Range }

function isNodeInsideCell(
  cell: HTMLTableCellElement,
  node: Node | null,
): node is Node {
  return !!node && (node === cell || cell.contains(node))
}

function createCellBoundaryPoint(
  cell: HTMLTableCellElement,
  node: Node | null,
  offset: number,
): CellBoundaryPoint | null {
  if (!isNodeInsideCell(cell, node)) return null

  const pointRange = document.createRange()
  try {
    pointRange.setStart(node, offset)
    pointRange.collapse(true)
  } catch {
    return null
  }

  return { node, offset, range: pointRange }
}

function getCellSelectionBoundaryPoints(
  cell: HTMLTableCellElement,
  selection: Selection,
): { earliest: CellBoundaryPoint | null, latest: CellBoundaryPoint | null } {
  let earliest: CellBoundaryPoint | null = null
  let latest: CellBoundaryPoint | null = null

  for (const candidate of [
    createCellBoundaryPoint(cell, selection.anchorNode, selection.anchorOffset),
    createCellBoundaryPoint(cell, selection.focusNode, selection.focusOffset),
  ]) {
    if (!candidate) continue

    if (
      !earliest ||
      candidate.range.compareBoundaryPoints(Range.START_TO_START, earliest.range) < 0
    ) {
      earliest = candidate
    }

    if (
      !latest ||
      candidate.range.compareBoundaryPoints(Range.START_TO_START, latest.range) > 0
    ) {
      latest = candidate
    }
  }

  return { earliest, latest }
}

function buildSafeCellSelectionRange(
  cell: HTMLTableCellElement,
  selection: Selection,
): Range {
  const safeRange = document.createRange()
  safeRange.selectNodeContents(cell)

  if (selection.rangeCount === 0) return safeRange

  const originalRange = selection.getRangeAt(0)

  let startAdjusted = false
  if (
    isNodeInsideCell(cell, originalRange.startContainer) &&
    safeRange.compareBoundaryPoints(Range.START_TO_START, originalRange) < 0
  ) {
    safeRange.setStart(originalRange.startContainer, originalRange.startOffset)
    startAdjusted = true
  }

  let endAdjusted = false
  if (
    isNodeInsideCell(cell, originalRange.endContainer) &&
    safeRange.compareBoundaryPoints(Range.END_TO_END, originalRange) > 0
  ) {
    safeRange.setEnd(originalRange.endContainer, originalRange.endOffset)
    endAdjusted = true
  }

  if (!startAdjusted || !endAdjusted) {
    // Some browsers report selection boundary containers on the surrounding
    // table structure even when the visual selection stays inside one cell.
    const { earliest: startPoint, latest: endPoint } = getCellSelectionBoundaryPoints(cell, selection)

    if (startPoint !== null && !startAdjusted) {
      const startRange = startPoint.range
      if (safeRange.compareBoundaryPoints(Range.START_TO_START, startRange) < 0) {
        safeRange.setStart(startPoint.node, startPoint.offset)
      }
    }

    if (endPoint !== null && !endAdjusted) {
      const endRange = endPoint.range
      if (safeRange.compareBoundaryPoints(Range.END_TO_END, endRange) > 0) {
        safeRange.setEnd(endPoint.node, endPoint.offset)
      }
    }
  }

  return safeRange
}

function onInput(event?: Event): void {
  if (isSyncing) return

  const sel = window.getSelection()
  // Fallback for quick typing: by the time the browser fires `input`,
  // the trailing space is already present in the DOM even if the earlier
  // `keydown` handler missed the just-typed shortcut character.
  if (event && tryApplyLineStartShortcut(sel, true)) {
    event.preventDefault?.()
  }

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
      const anchor = sel?.anchorNode
      const listItem = anchor instanceof HTMLElement
        ? anchor.closest('li')
        : anchor?.parentElement?.closest('li')

      if (listItem && (listItem.parentElement?.tagName === 'UL' || listItem.parentElement?.tagName === 'OL')) {
        e.preventDefault()

        const list = listItem.parentElement
        const isEmptyItem = !listItem.textContent?.trim() || listItem.innerHTML === '<br>'
        if (isEmptyItem) {
          const parentList = list
          const grandparentLi = parentList?.parentElement
          const isNested = grandparentLi?.tagName === 'LI'
          const listWillBeEmpty = parentList?.children.length === 1

          if (isNested && grandparentLi && parentList) {
            listItem.remove()
            if (listWillBeEmpty) {
              parentList.remove()
            }

            const outerList = grandparentLi.parentElement
            if (outerList && (outerList.tagName === 'UL' || outerList.tagName === 'OL')) {
              const newItem = document.createElement('li')
              newItem.innerHTML = '<br>'
              outerList.insertBefore(newItem, grandparentLi.nextSibling)

              const range = document.createRange()
              range.selectNodeContents(newItem)
              range.collapse(true)
              sel?.removeAllRanges()
              sel?.addRange(range)
            }
          } else if (parentList) {
            const exitBreak = document.createElement('br')
            if (listWillBeEmpty) {
              parentList.replaceWith(exitBreak)
            } else {
              listItem.remove()
              parentList.parentNode?.insertBefore(exitBreak, parentList.nextSibling)
            }

            const range = document.createRange()
            range.setStartAfter(exitBreak)
            range.collapse(true)
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        } else {
          const newItem = document.createElement('li')
          newItem.innerHTML = '<br>'
          list?.insertBefore(newItem, listItem.nextSibling)
          const range = document.createRange()
          range.selectNodeContents(newItem)
          range.collapse(true)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }

        onInput()
        return
      }

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
        const safeRange = buildSafeCellSelectionRange(cell, sel)
        sel.removeAllRanges()
        sel.addRange(safeRange)
        safeRange.deleteContents()
        sel.removeAllRanges()
        sel.addRange(safeRange)
        onInput()
        return
      }

      // Printable character with selection → replace selected text safely
      if (e.key.length === 1 && !mod) {
        e.preventDefault()
        const safeRange = buildSafeCellSelectionRange(cell, sel)
        sel.removeAllRanges()
        sel.addRange(safeRange)
        safeRange.deleteContents()
        const text = document.createTextNode(e.key)
        safeRange.insertNode(text)
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

  // ---- Space at line start: auto-create lists and headings ----
  // Detects markdown-style shortcuts: `* `, `- `, `1. `, `# `, `## `, `### `
  if (e.key === ' ' && !mod && !e.shiftKey && tryApplyLineStartShortcut(sel, false)) {
    e.preventDefault()
    onInput()
    return
  }

  // ---- Tab / Shift+Tab inside a list → indent / outdent ----
  if (e.key === 'Tab' && sel && sel.rangeCount > 0) {
    if (isInsideTag('li')) {
      e.preventDefault()
      emit('action', e.shiftKey ? 'outdentList' : 'indentList')
      return
    }
  }

  // ---- Enter on empty <li> inside a list → outdent or exit the list ----
  if (e.key === 'Enter' && !mod && !e.shiftKey && sel && sel.rangeCount > 0) {
    const anchor = sel.anchorNode
    const liEl = anchor instanceof HTMLElement
      ? anchor.closest('li')
      : anchor?.parentElement?.closest('li')

    if (liEl && editorEl.value?.contains(liEl)) {
      // An <li> is "empty" when it has no text and no nested sub-list
      const liText = liEl.textContent?.trim()
      const hasChildList = !!liEl.querySelector('ul, ol')
      const isEmpty = !liText && !hasChildList

      if (isEmpty) {
        e.preventDefault()

        const parentList = liEl.parentElement // <ul> or <ol>
        if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) {
          onInput()
          return
        }

        const grandparentLi = parentList.parentElement
        const isNested = grandparentLi?.tagName === 'LI'

        // Remove the empty <li>
        liEl.remove()

        // If parent list is now empty, remove it
        if (parentList.children.length === 0) {
          parentList.remove()
        }

        if (isNested && grandparentLi) {
          // Nested list → insert a new <li> after the grandparent <li> in the outer list
          const outerList = grandparentLi.parentElement
          if (outerList && (outerList.tagName === 'UL' || outerList.tagName === 'OL')) {
            const newLi = document.createElement('li')
            newLi.innerHTML = '<br>'
            outerList.insertBefore(newLi, grandparentLi.nextSibling)
            const newRange = document.createRange()
            newRange.selectNodeContents(newLi)
            newRange.collapse(true)
            sel.removeAllRanges()
            sel.addRange(newRange)
          }
        } else {
          // Root-level list → exit the list, insert a <p> after it
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          parentList.parentNode?.insertBefore(p, parentList.nextSibling)

          // If list is now empty, remove it entirely
          if (parentList.children.length === 0) {
            parentList.remove()
          }

          const newRange = document.createRange()
          newRange.selectNodeContents(p)
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
        }

        onInput()
        return
      }
    }
  }

  // ---- Enter on empty line inside a blockquote → exit the blockquote ----
  if (e.key === 'Enter' && !mod && !e.shiftKey && sel && sel.rangeCount > 0) {
    const anchor = sel.anchorNode
    const bqEl = anchor instanceof HTMLElement
      ? anchor.closest('blockquote')
      : anchor?.parentElement?.closest('blockquote')

    if (bqEl && editorEl.value?.contains(bqEl)) {
      // Find the block (p/div) the cursor is currently in within the blockquote
      let curBlock: HTMLElement | null = null
      let node: Node | null = anchor
      while (node && node !== bqEl) {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          /^(P|DIV)$/.test((node as HTMLElement).tagName)
        ) {
          curBlock = node as HTMLElement
          break
        }
        node = node.parentNode
      }

      // Check if the current line is empty (empty <p>, only <br>, or bare empty text)
      const isEmpty = curBlock
        ? !curBlock.textContent?.trim() || curBlock.innerHTML === '<br>'
        : !anchor?.textContent?.trim()

      if (isEmpty) {
        e.preventDefault()

        // Remove the empty block from the blockquote
        if (curBlock) {
          curBlock.remove()
        }

        // If blockquote is now empty, remove it entirely
        if (!bqEl.textContent?.trim() || bqEl.innerHTML === '' || bqEl.innerHTML === '<br>') {
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          bqEl.parentNode?.replaceChild(p, bqEl)
          const newRange = document.createRange()
          newRange.selectNodeContents(p)
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
        } else {
          // Blockquote still has content — insert a <p> after the blockquote
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          bqEl.parentNode?.insertBefore(p, bqEl.nextSibling)
          const newRange = document.createRange()
          newRange.selectNodeContents(p)
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
        }

        onInput()
        return
      }
    }
  }

  // ---- Enter inside a heading → exit to a new paragraph ----
  if (e.key === 'Enter' && !mod && !e.shiftKey && sel && sel.rangeCount > 0) {
    const anchor = sel.anchorNode
    const headingEl = anchor instanceof HTMLElement
      ? anchor.closest('h1, h2, h3, h4, h5, h6')
      : anchor?.parentElement?.closest('h1, h2, h3, h4, h5, h6')

    if (headingEl && editorEl.value?.contains(headingEl)) {
      e.preventDefault()
      const headingText = headingEl.textContent || ''

      if (!headingText.trim()) {
        // Empty heading → convert to plain paragraph
        const p = document.createElement('p')
        p.innerHTML = '<br>'
        headingEl.parentNode?.replaceChild(p, headingEl)
        const newRange = document.createRange()
        newRange.selectNodeContents(p)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
      } else {
        const range = sel.getRangeAt(0)

        // Check if cursor is at the very beginning of the heading
        const beforeRange = document.createRange()
        beforeRange.setStart(headingEl, 0)
        beforeRange.setEnd(range.startContainer, range.startOffset)
        const textBeforeCursor = beforeRange.toString()

        // Find the correct insertion point at the editor root level.
        // If the heading is nested (e.g. inside a <p> from a paste),
        // walk up to the top-level ancestor so the new element is
        // inserted as a direct child of the editor.
        const insertionAnchor = findEditorRootAncestor(headingEl)

        if (!textBeforeCursor) {
          // Cursor at beginning → insert empty paragraph BEFORE the heading.
          // This pushes the heading to the next line, keeping it intact.
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          insertionAnchor.parentNode?.insertBefore(p, insertionAnchor)
          // Cursor stays at the beginning of the heading (now on the next line)
        } else {
          // Has content after cursor → split at cursor
          const afterRange = document.createRange()
          afterRange.setStart(range.endContainer, range.endOffset)
          afterRange.setEnd(headingEl, headingEl.childNodes.length)
          const afterContent = afterRange.extractContents()

          const p = document.createElement('p')
          if (afterContent.textContent?.trim()) {
            p.appendChild(afterContent)
          } else {
            p.innerHTML = '<br>'
          }

          insertionAnchor.parentNode?.insertBefore(p, insertionAnchor.nextSibling)

          // If heading ended up empty after the split, add <br> to keep it visible
          if (!headingEl.textContent?.trim()) {
            headingEl.innerHTML = '<br>'
          }

          // Place cursor at start of new paragraph
          const newRange = document.createRange()
          newRange.selectNodeContents(p)
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
        }
      }

      onInput()
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

      // Check whether the <code> sits inside a proper block element or is
      // loose at the editor root (happens on empty documents).
      let blockParent: HTMLElement | null = codeEl.parentElement
      while (blockParent && blockParent !== editorEl.value) {
        if (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|TD|TH)$/.test(blockParent.tagName)) break
        blockParent = blockParent.parentElement
      }

      if (!blockParent || blockParent === editorEl.value) {
        // Root-level <code> — wrap it in a <p> and create a new <p> for the
        // next line so the document has proper block structure.
        const p = document.createElement('p')
        codeEl.parentNode!.insertBefore(p, codeEl)
        p.appendChild(codeEl)

        const newP = document.createElement('p')
        newP.innerHTML = '<br>'
        p.parentNode!.insertBefore(newP, p.nextSibling)

        const newRange = document.createRange()
        newRange.selectNodeContents(newP)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
      } else {
        // Code is inside a proper block — move cursor out of the <code>
        // and insert a line break so new text is unstyled.
        const range = document.createRange()
        range.setStartAfter(codeEl)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
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

/* ---- Image insert helper ---- */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function insertImageFile(file: File): Promise<void> {
  const maxSize = props.maxImageSize ?? DEFAULT_MAX_IMAGE_SIZE
  if (file.size > maxSize) return
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return

  let src: string
  if (props.onImageUpload) {
    try {
      src = await props.onImageUpload(file)
    } catch {
      return // upload failed — do nothing
    }
  } else {
    src = await fileToBase64(file)
  }

  const img = document.createElement('img')
  img.src = src
  img.alt = file.name || 'pasted image'

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !editorEl.value) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(img)

  // Move cursor after the image
  const newRange = document.createRange()
  newRange.setStartAfter(img)
  newRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(newRange)

  onInput()
}

/* ---- Drop handler ---- */

function onDrop(e: DragEvent): void {
  if (props.disabled) return
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const imageFile = Array.from(files).find((f) => ACCEPTED_IMAGE_TYPES.includes(f.type))
  if (!imageFile) return

  e.preventDefault()

  // Place cursor at the drop point
  const sel = window.getSelection()
  if (sel && e.clientX !== undefined) {
    // caretRangeFromPoint to place cursor at the drop coordinates
    let range: Range | null = null
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY)
    }
    if (range) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  insertImageFile(imageFile)
}

/* ---- Paste handler ---- */

function onPaste(e: ClipboardEvent): void {
  e.preventDefault()

  // ---- Image file in clipboard (screenshot paste, etc.) ----
  const files = e.clipboardData?.files
  if (files && files.length > 0) {
    const imageFile = Array.from(files).find((f) => ACCEPTED_IMAGE_TYPES.includes(f.type))
    if (imageFile) {
      insertImageFile(imageFile)
      return
    }
  }

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

  // ---- Flatten pasted list items when pasting inside an existing list ----
  // When the clipboard contains <ul>/<ol> with <li> items and we're pasting
  // into an existing list, we unwrap the list containers AND convert each
  // <li> into its inner content so they merge cleanly into the existing
  // list structure without creating nested lists (e.g. `- - item`).
  const anchorNode = sel.anchorNode
  const targetLi = anchorNode instanceof HTMLElement
    ? anchorNode.closest('li')
    : anchorNode?.parentElement?.closest('li')

  if (targetLi) {
    const parentList = targetLi.parentElement // the <ul> or <ol>

    // Collect <li> elements from pasted lists and insert them as siblings
    // after the current <li> in the parent list.
    const pastedLists = Array.from(temp.querySelectorAll(':scope > ul, :scope > ol'))
    if (pastedLists.length > 0) {
      // Gather all <li> items to insert as siblings
      const newItems: HTMLLIElement[] = []
      for (const list of pastedLists) {
        for (const li of Array.from(list.querySelectorAll('li'))) {
          newItems.push(li as HTMLLIElement)
        }
        // Remove the list wrapper from the temp — its items will be inserted
        // directly into the parent list
        list.remove()
      }

      // Any remaining non-list content in temp goes into the current <li>
      // (e.g. plain text that was before/after the pasted list)
      const frag = document.createDocumentFragment()
      let lastInline: Node | null = null
      while (temp.firstChild) {
        lastInline = frag.appendChild(temp.firstChild)
      }
      if (frag.childNodes.length > 0) {
        range.insertNode(frag)
      }

      // Insert extracted <li> elements after the current <li> in the parent list
      if (parentList) {
        let insertAfter: Node = targetLi
        for (const li of newItems) {
          if (insertAfter.nextSibling) {
            parentList.insertBefore(li, insertAfter.nextSibling)
          } else {
            parentList.appendChild(li)
          }
          insertAfter = li
        }

        // Place cursor at the end of the last inserted <li>
        const lastLi = newItems[newItems.length - 1] ?? targetLi
        const cursorRange = document.createRange()
        cursorRange.selectNodeContents(lastLi)
        cursorRange.collapse(false) // collapse to end
        sel.removeAllRanges()
        sel.addRange(cursorRange)
      }

      onInput()
      return
    }
  }

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

  // Lift any block-level elements that ended up nested inside <p> tags
  // (e.g. pasting a heading while the cursor was inside a paragraph).
  normalizeNestedBlocks()

  // Trigger sync
  onInput()
}

function onSelectionChange(): void {
  emit('selectionChange')
}

function tryApplyLineStartShortcut(sel: Selection | null, includeTrailingSpace: boolean): boolean {
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false

  const block = findShortcutBlock(sel)
  if (
    !block ||
    !editorEl.value ||
    !editorEl.value.contains(block) ||
    isInsideSpecialContainer(block)
  ) {
    return false
  }

  const blockText = normalizeShortcutText(block.textContent || '')
  const bulletPattern = includeTrailingSpace ? /^([*-]) $/ : /^([*-])$/
  const orderedPattern = includeTrailingSpace ? /^(\d+)\. $/ : /^(\d+)\.$/
  const headingPattern = includeTrailingSpace ? /^(#{1,3}) $/ : /^(#{1,3})$/

  if (bulletPattern.test(blockText)) {
    const list = document.createElement('ul')
    const li = document.createElement('li')
    li.innerHTML = '<br>'
    list.appendChild(li)
    block.parentNode!.replaceChild(list, block)
    placeCursorAtStart(sel, li)
    return true
  }

  const orderedMatch = blockText.match(orderedPattern)
  if (orderedMatch) {
    const list = document.createElement('ol')
    const startNum = parseInt(orderedMatch[1], 10)
    if (startNum !== 1) list.setAttribute('start', String(startNum))
    const li = document.createElement('li')
    li.innerHTML = '<br>'
    list.appendChild(li)
    block.parentNode!.replaceChild(list, block)
    placeCursorAtStart(sel, li)
    return true
  }

  const headingMatch = blockText.match(headingPattern)
  if (headingMatch) {
    const level = headingMatch[1].length as 1 | 2 | 3
    const heading = document.createElement(`h${level}`)
    heading.innerHTML = '<br>'
    block.parentNode!.replaceChild(heading, block)
    placeCursorAtStart(sel, heading)
    return true
  }

  return false
}

/* ---- DOM normalisation helpers ---- */

/** Block-level tags that must NOT be nested inside a <p>. */
const BLOCK_TAGS = /^(H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|HR|DIV)$/

/**
 * Check whether `block` sits inside a list, blockquote, table,
 * code block, or heading (between `block` and the editor root).
 * Used to prevent auto-generation inside those containers.
 */
function isInsideSpecialContainer(block: HTMLElement): boolean {
  let el: HTMLElement | null = block.parentElement
  while (el && el !== editorEl.value) {
    if (/^(UL|OL|BLOCKQUOTE|PRE|TABLE|THEAD|TBODY|TR|TH|TD|H[1-6])$/.test(el.tagName)) {
      return true
    }
    el = el.parentElement
  }
  return false
}

function findShortcutBlock(sel: Selection): HTMLElement | null {
  let block: HTMLElement | null = null
  let node: Node | null = sel.anchorNode

  while (node && node !== editorEl.value) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      /^(P|DIV)$/.test((node as HTMLElement).tagName)
    ) {
      block = node as HTMLElement
      break
    }
    node = node.parentNode
  }

  // Empty documents can briefly contain bare text nodes at the editor root.
  // Wrap that content so the shortcut replacement can still operate.
  if (!block && editorEl.value && sel.anchorNode) {
    const anchor = sel.anchorNode
    let directChild: Node | null = anchor
    let hitBlock = false

    while (directChild && directChild.parentNode !== editorEl.value) {
      if (
        directChild.nodeType === Node.ELEMENT_NODE &&
        /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE)$/.test((directChild as HTMLElement).tagName)
      ) {
        hitBlock = true
        break
      }
      directChild = directChild.parentNode
    }

    if (!hitBlock && directChild && directChild.parentNode === editorEl.value) {
      const cursorOffset = sel.getRangeAt(0).startOffset
      const wrapper = document.createElement('p')
      editorEl.value.insertBefore(wrapper, directChild)
      wrapper.appendChild(directChild)

      const newRange = document.createRange()
      newRange.setStart(anchor, Math.min(cursorOffset, anchor.nodeType === Node.TEXT_NODE ? (anchor as Text).length : 0))
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      block = wrapper
    }
  }

  return block
}

function normalizeShortcutText(text: string): string {
  return text
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
}

function placeCursorAtStart(sel: Selection, el: HTMLElement): void {
  const newRange = document.createRange()
  newRange.selectNodeContents(el)
  newRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(newRange)
}

/**
 * Walk from `node` up to the direct child of the editor root.
 * Returns that top-level ancestor, which is where new sibling
 * elements should be inserted.
 */
function findEditorRootAncestor(node: Node): Node {
  let anc: Node = node
  while (anc.parentNode && anc.parentNode !== editorEl.value) {
    anc = anc.parentNode
  }
  return anc
}

/**
 * Lift block-level elements that ended up nested inside <p> tags.
 *
 * After paste (or other DOM mutations) the editor can contain
 * structures like `<p><h2>…</h2></p>`.  This function splits
 * such `<p>` elements so every block-level child becomes a
 * direct child of the editor root.
 */
function normalizeNestedBlocks(): void {
  if (!editorEl.value) return

  for (const p of Array.from(editorEl.value.querySelectorAll('p'))) {
    // Skip if the <p> is not a direct child of the editor
    if (p.parentElement !== editorEl.value) continue

    const hasNestedBlock = Array.from(p.childNodes).some(
      (n) => n.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.test((n as HTMLElement).tagName),
    )
    if (!hasNestedBlock) continue

    // Split: walk through child nodes and lift block elements
    const parent = p.parentNode!
    let currentP: HTMLParagraphElement | null = null

    for (const child of Array.from(p.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.test((child as HTMLElement).tagName)) {
        // Flush any accumulated inline content
        if (currentP && (currentP.textContent?.trim() || currentP.querySelector('img, br'))) {
          parent.insertBefore(currentP, p)
        }
        currentP = null
        // Lift the block element out
        parent.insertBefore(child, p)
      } else {
        // Inline content → accumulate into a <p>
        if (!currentP) {
          currentP = document.createElement('p')
        }
        currentP.appendChild(child)
      }
    }

    // Flush trailing inline content
    if (currentP && (currentP.textContent?.trim() || currentP.querySelector('img, br'))) {
      parent.insertBefore(currentP, p)
    }

    // Remove the now-empty original <p>
    p.remove()
  }
}
</script>
