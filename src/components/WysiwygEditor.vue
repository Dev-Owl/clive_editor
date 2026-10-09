<template>
  <div class="ce-wysiwyg-wrap">
    <TableControls :editor-el="editorEl" :disabled="disabled" @change="onInput" />
    <div v-if="selectedImage" class="ce-image-controls"
      :style="{ top: `${imageControlsPosition.top}px`, left: `${imageControlsPosition.left}px` }" @mousedown.stop
      @click.stop>
      <div class="ce-image-controls__group">
        <button v-for="preset in IMAGE_SIZE_PRESETS" :key="preset" type="button" class="ce-image-controls__btn"
          :class="{ 'ce-image-controls__btn--active': currentImageWidth === preset }"
          :title="`Resize image to ${preset}`" @click="applyPresetImageWidth(preset)">
          {{ preset }}
        </button>
        <button type="button" class="ce-image-controls__btn"
          :class="{ 'ce-image-controls__btn--active': showCustomImageWidth }" title="Custom image size"
          @click="toggleCustomImageWidth">
          Custom
        </button>
      </div>
      <form v-if="showCustomImageWidth" class="ce-image-controls__custom" @submit.prevent="applyCustomImageWidth">
        <input ref="customImageWidthInput" v-model="customImageWidth" type="number" min="1" max="100" step="1"
          class="ce-image-controls__input" aria-label="Custom image width percentage">
        <span class="ce-image-controls__suffix">%</span>
        <button type="submit" class="ce-image-controls__btn" title="Apply custom image size">Apply</button>
      </form>
    </div>
    <div ref="editorEl" class="ce-wysiwyg" contenteditable="true" role="textbox" aria-multiline="true"
      :aria-label="placeholder || 'Rich text editor'" :data-placeholder="placeholder" spellcheck="true"
      @input="onInput($event)" @keydown="onKeydown" @keyup="onSelectionChange" @paste="onPaste" @drop="onDrop"
      @dragover.prevent @click="onClick" @mouseup="onSelectionChange" @blur="onBlur" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { sanitizeHtml } from '@/utils/sanitize'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'
import { sanitizeRenderedHtml, type SanitizeFn } from '@/utils/renderSanitizer'
import type { ToolbarAction } from '@/types'
import {
  IMAGE_SIZE_PRESETS,
  applyImageSizingMetadata,
  applyImageWidth,
  getImageWidth,
  normalizeImageWidth,
} from '@/utils/imageSizing'
import {
  findClosestCell,
  isSelectionCrossCell,
  handleCrossCellDelete,
  getAdjacentCell,
  isInsideTag,
} from '@/utils/selection'
import {
  getListItemOwnContentEnd,
  isListElement,
  listItemHasOwnContent,
  repairOrphanedListItems,
} from '@/utils/lists'
import TableControls from './TableControls.vue'

/* ---- Props / Emits ---- */

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const DEFAULT_MAX_IMAGE_SIZE = 2_097_152 // 2 MB
const LIST_MARKER_TEXT_RE = /^(\s*)([-+*]|\d+\.)\s+(.*)$/
const CODE_BLOCK_TRAILING_CARET_SENTINEL = '\u200B'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  /** Optional highlight function for syntax highlighting code blocks */
  highlight?: (code: string, lang: string) => string
  /** Replaces the default sanitiser for rendered HTML */
  sanitize?: SanitizeFn
  /** Called when an image is pasted or dropped. Return a URL string. */
  onImageUpload?: (file: File) => Promise<string>
  /** Max image file size in bytes (default: 2 MB) */
  maxImageSize?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  selectionChange: []
  action: [actionName: ToolbarAction]
}>()

/* ---- Refs ---- */

const editorEl = ref<HTMLElement | null>(null)
let isSyncing = false
const selectedImage = ref<HTMLImageElement | null>(null)
const currentImageWidth = ref<string | null>(null)
const showCustomImageWidth = ref(false)
const customImageWidth = ref('')
const customImageWidthInput = ref<HTMLInputElement | null>(null)
const imageControlsPosition = ref({ top: 0, left: 0 })

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
      applyImageSizingMetadata(editorEl.value)
      normalizeListStructure()
      normalizeCodeBlocks()
      isSyncing = false
      clearImageSelection()
    }
  },
  /** Sync HTML → markdown and return the markdown */
  syncToMarkdown: (): string => {
    if (!editorEl.value) return props.modelValue
    // Cancel any pending debounced emit: the caller is taking the freshly
    // serialized value now, so a later timer firing would only re-emit an
    // equal or stale value. Defensive — avoids redundant post-sync emits.
    if (inputTimer) {
      clearTimeout(inputTimer)
      inputTimer = null
    }
    return serializeHtml(editorEl.value.innerHTML)
  },
  /** Re-render from current modelValue */
  refreshFromMarkdown: () => {
    if (!editorEl.value) return
    isSyncing = true
    editorEl.value.innerHTML = parseMarkdown(props.modelValue, {
      highlight: props.highlight,
      sanitize: props.sanitize,
    })
    normalizeListStructure()
    normalizeCodeBlocks()
    isSyncing = false
    clearImageSelection()
  },
  /** Focus the editor */
  focus: () => editorEl.value?.focus(),
})

/* ---- Lifecycle ---- */

onMounted(() => {
  if (editorEl.value && props.modelValue) {
    editorEl.value.innerHTML = parseMarkdown(props.modelValue, {
      highlight: props.highlight,
      sanitize: props.sanitize,
    })
    applyImageSizingMetadata(editorEl.value)
    // Heal documents that already contain marker-only list items so the
    // visual list renders at the levels the author intended
    normalizeListStructure()
    normalizeCodeBlocks()
  }
  // Listen for modifier keys to show clickable-link cursor hint
  window.addEventListener('keydown', onModifierDown)
  window.addEventListener('keyup', onModifierUp)
  window.addEventListener('blur', onModifierUp)
  window.addEventListener('resize', updateImageControlsPosition)
  document.addEventListener('mousedown', onDocumentMouseDown)
})

onBeforeUnmount(() => {
  // Flush pending input before teardown so the last keystrokes aren't lost if
  // the component unmounts inside the debounce window.
  flushInput()
  if (highlightTimer) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
  window.removeEventListener('keydown', onModifierDown)
  window.removeEventListener('keyup', onModifierUp)
  window.removeEventListener('blur', onModifierUp)
  window.removeEventListener('resize', updateImageControlsPosition)
  document.removeEventListener('mousedown', onDocumentMouseDown)
  clearImageSelection()
})

function onModifierDown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && editorEl.value) {
    editorEl.value.classList.add('ce-links-clickable')
  }
}
function onModifierUp(e?: KeyboardEvent | Event): void {
  editorEl.value?.classList.remove('ce-links-clickable')
}

function clearImageSelection(): void {
  selectedImage.value?.classList.remove('ce-image--selected')
  selectedImage.value = null
  currentImageWidth.value = null
  showCustomImageWidth.value = false
  customImageWidth.value = ''
}

function updateImageControlsPosition(): void {
  if (!selectedImage.value || !editorEl.value) return

  const wrapRect = editorEl.value.parentElement?.getBoundingClientRect()
  const imageRect = selectedImage.value.getBoundingClientRect()
  if (!wrapRect) return

  imageControlsPosition.value = {
    top: Math.max(8, imageRect.top - wrapRect.top - 44),
    left: imageRect.left - wrapRect.left + imageRect.width / 2,
  }
}

function selectImage(img: HTMLImageElement): void {
  if (selectedImage.value === img) {
    currentImageWidth.value = getImageWidth(img)
    customImageWidth.value = currentImageWidth.value?.replace('%', '') ?? ''
    nextTick(updateImageControlsPosition)
    return
  }

  clearImageSelection()
  selectedImage.value = img
  selectedImage.value.classList.add('ce-image--selected')
  currentImageWidth.value = getImageWidth(img)
  customImageWidth.value = currentImageWidth.value?.replace('%', '') ?? ''
  nextTick(updateImageControlsPosition)
}

function applyImageResize(width: string): void {
  if (!selectedImage.value) return

  const appliedWidth = applyImageWidth(selectedImage.value, width)
  if (!appliedWidth) return

  currentImageWidth.value = appliedWidth
  customImageWidth.value = appliedWidth.replace('%', '')
  showCustomImageWidth.value = false
  onInput()
  nextTick(updateImageControlsPosition)
}

function applyPresetImageWidth(width: string): void {
  applyImageResize(width)
}

function toggleCustomImageWidth(): void {
  showCustomImageWidth.value = !showCustomImageWidth.value
  customImageWidth.value = currentImageWidth.value?.replace('%', '') ?? ''

  if (showCustomImageWidth.value) {
    nextTick(() => {
      customImageWidthInput.value?.focus()
      customImageWidthInput.value?.select()
    })
  }
}

function applyCustomImageWidth(): void {
  const normalizedWidth = normalizeImageWidth(customImageWidth.value)
  if (!normalizedWidth) return
  applyImageResize(normalizedWidth)
}

function onDocumentMouseDown(event: MouseEvent): void {
  const target = event.target as Node | null
  const wrapEl = editorEl.value?.parentElement

  if (!target || !wrapEl) {
    clearImageSelection()
    return
  }

  if (wrapEl.contains(target)) return
  clearImageSelection()
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
      clearImageSelection()
      editorEl.value.innerHTML = parseMarkdown(md, {
        highlight: props.highlight,
        sanitize: props.sanitize,
      })
      applyImageSizingMetadata(editorEl.value)
      normalizeListStructure()
      normalizeCodeBlocks()
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

function onBlur(): void {
  // Flush any pending debounced markdown so leaving the editor never drops
  // the last few keystrokes.
  flushInput()
}

function onInput(event?: Event): void {
  if (isSyncing) return

  if (
    event?.target instanceof HTMLInputElement
    || event?.target instanceof HTMLTextAreaElement
    || event?.target instanceof HTMLSelectElement
  ) {
    return
  }

  if (selectedImage.value && !selectedImage.value.isConnected) {
    clearImageSelection()
  }

  const sel = window.getSelection()
  // Fallback for quick typing: by the time the browser fires `input`,
  // the trailing space is already present in the DOM even if the earlier
  // `keydown` handler missed the just-typed shortcut character.
  if (event && tryApplyLineStartShortcut(sel, true)) {
    event.preventDefault?.()
  }

  normalizeEmptyInlineCode(sel)
  normalizePresentationalInlineArtifacts()
  normalizeListStructure()

  // Debounced re-highlight of the current code block
  if (props.highlight) {
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => {
      rehighlightCurrentBlock()
    }, 300)
  }

  normalizeCodeBlocks({ placeCaret: true })

  // Debounced emit of markdown value
  if (inputTimer) clearTimeout(inputTimer)
  inputTimer = setTimeout(flushInput, 100)
}

/**
 * Serialize the current DOM to markdown and emit it immediately, cancelling
 * any pending debounced emit. Called by the debounce timer and also on blur /
 * before unmount so the latest keystrokes are never lost when the debounce
 * window is still open.
 */
function flushInput(): void {
  if (inputTimer) {
    clearTimeout(inputTimer)
    inputTimer = null
  }
  if (!editorEl.value) return
  const md = serializeHtml(editorEl.value.innerHTML)
  if (md === props.modelValue) return
  isSyncing = true
  emit('update:modelValue', md)
  isSyncing = false
}

function onKeydown(e: KeyboardEvent): void {
  if (props.disabled) {
    e.preventDefault()
    return
  }

  if (
    e.target instanceof HTMLInputElement
    || e.target instanceof HTMLTextAreaElement
    || e.target instanceof HTMLSelectElement
  ) {
    return
  }

  const mod = e.ctrlKey || e.metaKey
  const sel = window.getSelection()

  if (mod && e.key.toLocaleLowerCase() === 'a' && sel && sel.rangeCount > 0) {
    const anchor = sel.anchorNode
    const preEl = anchor instanceof HTMLElement
      ? anchor.closest('pre')
      : anchor?.parentElement?.closest('pre')

    if (preEl && editorEl.value?.contains(preEl)) {
      e.preventDefault()
      const codeEl = ensureCodeElement(preEl)
      const range = document.createRange()
      range.selectNodeContents(codeEl)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
  }

  if (sel && sel.rangeCount > 0) {
    const anchor = sel.anchorNode
    const preEl = anchor instanceof HTMLElement
      ? anchor.closest('pre')
      : anchor?.parentElement?.closest('pre')

    if (preEl && editorEl.value?.contains(preEl)) {
      const codeEl = ensureCodeElement(preEl)
      const range = sel.getRangeAt(0)
      const startOffset = getCodeTextOffsetAtBoundary(codeEl, range.startContainer, range.startOffset)
      const endOffset = getCodeTextOffsetAtBoundary(codeEl, range.endContainer, range.endOffset)
      const selectionStart = Math.min(startOffset, endOffset)
      const selectionEnd = Math.max(startOffset, endOffset)
      const rawCode = getSerializableCodeText(codeEl)

      if (e.key === 'Backspace') {
        if (selectionStart !== selectionEnd) {
          e.preventDefault()
          setCodeBlockText(codeEl, `${rawCode.slice(0, selectionStart)}${rawCode.slice(selectionEnd)}`)
          restoreCursorInCode(codeEl, selectionStart, sel)
          onInput()
          return
        }

        if (selectionStart > 0) {
          e.preventDefault()
          setCodeBlockText(codeEl, `${rawCode.slice(0, selectionStart - 1)}${rawCode.slice(selectionEnd)}`)
          restoreCursorInCode(codeEl, selectionStart - 1, sel)
          onInput()
          return
        }
      }

      if (e.key === 'Delete') {
        if (selectionStart !== selectionEnd) {
          e.preventDefault()
          setCodeBlockText(codeEl, `${rawCode.slice(0, selectionStart)}${rawCode.slice(selectionEnd)}`)
          restoreCursorInCode(codeEl, selectionStart, sel)
          onInput()
          return
        }

        if (selectionStart < rawCode.length) {
          e.preventDefault()
          setCodeBlockText(codeEl, `${rawCode.slice(0, selectionStart)}${rawCode.slice(selectionStart + 1)}`)
          restoreCursorInCode(codeEl, selectionStart, sel)
          onInput()
          return
        }
      }

      if (e.key.length === 1 && !mod && !e.altKey) {
        e.preventDefault()
        setCodeBlockText(codeEl, `${rawCode.slice(0, selectionStart)}${e.key}${rawCode.slice(selectionEnd)}`)
        restoreCursorInCode(codeEl, selectionStart + e.key.length, sel)
        onInput()
        return
      }
    }
  }

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

  // ---- ArrowUp on the first line of the first code block → move above it ----
  if (e.key === 'ArrowUp' && !mod && !e.shiftKey && sel) {
    const insertionAnchor = findCodeBlockArrowUpExitTarget(sel)
    if (insertionAnchor) {
      e.preventDefault()
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      insertionAnchor.parentNode?.insertBefore(p, insertionAnchor)
      placeCursorAtStart(sel, p)
      onInput()
      return
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

  // ---- Backspace on a list item without text of its own ----
  // Removing such a bullet is where the browser does the most damage: it
  // strips the item's placeholder and leaves the sub-list in a text-less item
  // (`-   -   text`), or dissolves the list altogether.
  if (e.key === 'Backspace' && !mod && sel && sel.isCollapsed && sel.rangeCount > 0) {
    const anchor = sel.anchorNode
    const liEl = anchor instanceof HTMLElement
      ? anchor.closest('li')
      : anchor?.parentElement?.closest('li')

    if (
      liEl
      && editorEl.value?.contains(liEl)
      && !listItemHasOwnContent(liEl)
      && isSelectionInListItemOwnContent(sel, liEl)
    ) {
      const outcome = removeContentlessListItem(sel, liEl)
      if (outcome === 'outdent') {
        e.preventDefault()
        emit('action', 'outdentList')
        return
      }
      if (outcome === 'handled') {
        e.preventDefault()
        onInput()
        return
      }
    }
  }

  // ---- Enter inside a list item → split, outdent or exit the list ----
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
      const parentList = liEl.parentElement

      // Splitting a list item is always handled here, never by the browser:
      // for an item with a nested sub-list the browser moves that sub-list
      // into the new item, leaving a marker-only item behind that serializes
      // to `-   -   text`.
      if (
        !isEmpty
        && parentList
        && (parentList.tagName === 'UL' || parentList.tagName === 'OL')
        && isSelectionInListItemOwnContent(sel, liEl)
      ) {
        e.preventDefault()

        if (isCollapsedSelectionAtListItemContentStart(sel, liEl)) {
          // Caret at the very start → push the item down, keep editing it
          const newLi = document.createElement('li')
          newLi.innerHTML = '<br>'
          parentList.insertBefore(newLi, liEl)
        } else if (isCollapsedSelectionAtListItemContentEnd(sel, liEl)) {
          // Caret at the end of the item's own text → start a fresh item
          // after the whole item, sub-list included
          const newLi = document.createElement('li')
          newLi.innerHTML = '<br>'
          parentList.insertBefore(newLi, liEl.nextSibling)
          placeCursorAtStart(sel, newLi)
        } else {
          splitListItemAtSelection(sel, liEl)
        }

        onInput()
        return
      }

      if (isEmpty) {
        e.preventDefault()

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
        // Code is inside a proper block — split to a sibling paragraph so the
        // inline code remains isolated in its original block.
        const insertionAnchor = findEditorRootAncestor(blockParent)
        const newP = document.createElement('p')
        newP.innerHTML = '<br>'
        insertionAnchor.parentNode?.insertBefore(newP, insertionAnchor.nextSibling)

        const range = document.createRange()
        range.selectNodeContents(newP)
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
      const codeEl = ensureCodeElement(preEl)
      const range = sel.getRangeAt(0)
      const startOffset = getCodeTextOffsetAtBoundary(codeEl, range.startContainer, range.startOffset)
      const endOffset = getCodeTextOffsetAtBoundary(codeEl, range.endContainer, range.endOffset)
      const selectionStart = Math.min(startOffset, endOffset)
      const selectionEnd = Math.max(startOffset, endOffset)
      const rawCode = getSerializableCodeText(codeEl)

      setCodeBlockText(codeEl, `${rawCode.slice(0, selectionStart)}\n${rawCode.slice(selectionEnd)}`)
      restoreCursorInCode(codeEl, selectionStart + 1, sel, { preferTrailingBlankLine: true })
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
  const target = e.target as HTMLElement

  const image = target instanceof HTMLImageElement
    ? target
    : target.closest('img') as HTMLImageElement | null
  if (image && editorEl.value?.contains(image)) {
    e.preventDefault()
    e.stopPropagation()
    selectImage(image)
    return
  }

  clearImageSelection()

  // ---- Language label click → show inline input ----
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

  // In-document links (`#heading-id`) jump to the heading inside the editor
  // instead of opening the page again in a new tab
  if (href.startsWith('#')) {
    scrollToAnchor(decodeURIComponent(href.slice(1)))
    return
  }

  window.open(href, '_blank', 'noopener,noreferrer')
}

function scrollToAnchor(id: string): void {
  if (!id || !editorEl.value) return
  const target = editorEl.value.querySelector(`[id="${CSS.escape(id)}"]`)
  target?.scrollIntoView({ block: 'start' })
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

  const stopEditorEventPropagation = (ev: Event) => {
    ev.stopPropagation()
  }

  input.addEventListener('keydown', stopEditorEventPropagation)
  input.addEventListener('keyup', stopEditorEventPropagation)
  input.addEventListener('input', stopEditorEventPropagation)
  input.addEventListener('mousedown', stopEditorEventPropagation)
  input.addEventListener('mouseup', stopEditorEventPropagation)
  input.addEventListener('click', stopEditorEventPropagation)

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
        const rawCode = getSerializableCodeText(codeEl)
        const highlighted = props.highlight(rawCode, newLang)
        if (highlighted) {
          // Shiki returns <pre><code>…</code></pre>, extract the inner HTML
          const match = highlighted.match(/<code[^>]*>([\s\S]*)<\/code>/)
          if (match) {
            codeEl.innerHTML = sanitizeCodeHtml(match[1])
          }
        }
      } else {
        // No highlighting — ensure we show plain text
        const rawCode = getSerializableCodeText(codeEl)
        setCodeBlockText(codeEl, rawCode)
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

/** Highlighter output goes through the same sanitiser as rendered markdown. */
function sanitizeCodeHtml(html: string): string {
  return (props.sanitize ?? sanitizeRenderedHtml)(html)
}

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

  const rawCode = getSerializableCodeText(codeEl)
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
  codeEl.innerHTML = sanitizeCodeHtml(match[1])

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
  options?: { preferTrailingBlankLine?: boolean },
): void {
  if (
    options?.preferTrailingBlankLine &&
    caretOffset === getSerializableCodeText(codeEl).length &&
    codeEl.textContent?.endsWith(CODE_BLOCK_TRAILING_CARET_SENTINEL)
  ) {
    const trailingSentinel = findTrailingCodeCaretSentinel(codeEl)
    if (trailingSentinel) {
      const newRange = document.createRange()
      newRange.setStart(trailingSentinel, 0)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      return
    }
  }

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

function getCodeTextOffsetAtBoundary(codeEl: HTMLElement, container: Node, offset: number): number {
  const codeLength = codeEl.textContent?.length ?? 0
  const boundaryRange = document.createRange()
  boundaryRange.setStart(container, offset)
  boundaryRange.collapse(true)

  const codeStart = document.createRange()
  codeStart.selectNodeContents(codeEl)
  codeStart.collapse(true)

  const codeEnd = document.createRange()
  codeEnd.selectNodeContents(codeEl)
  codeEnd.collapse(false)

  if (boundaryRange.compareBoundaryPoints(Range.START_TO_START, codeStart) <= 0) {
    return 0
  }

  if (boundaryRange.compareBoundaryPoints(Range.START_TO_START, codeEnd) >= 0) {
    return codeLength
  }

  if (container !== codeEl && !codeEl.contains(container)) {
    return codeLength
  }

  const caretRange = document.createRange()
  caretRange.selectNodeContents(codeEl)
  caretRange.setEnd(container, offset)
  return caretRange.toString().length
}

function ensureCodeElement(preEl: HTMLPreElement): HTMLElement {
  const existingCodeEl = preEl.querySelector('code')
  if (existingCodeEl) return existingCodeEl

  const codeEl = document.createElement('code')
  preEl.appendChild(codeEl)
  return codeEl
}

function getSerializableCodeText(codeEl: HTMLElement): string {
  return (codeEl.textContent || '').replace(/\u200B$/, '')
}

function setCodeBlockText(codeEl: HTMLElement, text: string): void {
  // An empty <code> has no line box, so the block collapses and can no longer
  // be clicked into — keep the caret sentinel as its only character instead.
  codeEl.textContent = text === '' || text.endsWith('\n')
    ? `${text}${CODE_BLOCK_TRAILING_CARET_SENTINEL}`
    : text
}

/**
 * Keep every code block editable: restore a <code> element the browser
 * removed, and give an empty one the caret sentinel so it keeps a line box.
 * With `placeCaret`, a caret inside a repaired block is moved into its <code>.
 */
function normalizeCodeBlocks(options?: { placeCaret?: boolean }): void {
  if (!editorEl.value) return
  const sel = window.getSelection()

  for (const pre of editorEl.value.querySelectorAll('pre')) {
    let codeEl = pre.querySelector('code')
    const missingCode = !codeEl
    if (!codeEl) {
      const labelEl = pre.querySelector<HTMLElement>('.ce-code-lang')
      const lang = labelEl?.dataset?.lang ?? ''
      codeEl = document.createElement('code')
      if (lang) codeEl.className = `language-${lang}`
      pre.appendChild(codeEl)
    }
    if (!missingCode && codeEl.textContent !== '') {
      removeStrayCodeCaretSentinels(codeEl)
      continue
    }

    setCodeBlockText(codeEl, '')

    const caretInBlock = !!sel && sel.rangeCount > 0 && !!sel.anchorNode && pre.contains(sel.anchorNode)
    if (options?.placeCaret && sel && (missingCode || caretInBlock)) {
      restoreCursorInCode(codeEl, 0, sel)
    }
  }
}

/**
 * Text inserted natively (IME, autocorrect, mobile keyboards) can land on
 * either side of the caret sentinel. Drop every sentinel except one that is
 * the sole content or trails a final newline, so none leaks into markdown.
 * `deleteData` keeps the live selection range adjusted.
 */
function removeStrayCodeCaretSentinels(codeEl: HTMLElement): void {
  const text = codeEl.textContent ?? ''
  if (!text.includes(CODE_BLOCK_TRAILING_CARET_SENTINEL)) return

  const keepIndex = text === CODE_BLOCK_TRAILING_CARET_SENTINEL
    || text.endsWith(`\n${CODE_BLOCK_TRAILING_CARET_SENTINEL}`)
    ? text.length - 1
    : -1

  const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  let nodeStart = 0
  for (const node of textNodes) {
    const original = node.data
    for (let i = original.length - 1; i >= 0; i--) {
      if (original[i] === CODE_BLOCK_TRAILING_CARET_SENTINEL && nodeStart + i !== keepIndex) {
        node.deleteData(i, 1)
      }
    }
    nodeStart += original.length
  }
}

function findTrailingCodeCaretSentinel(codeEl: HTMLElement): Text | null {
  const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT)
  let lastTextNode: Text | null = null

  while (walker.nextNode()) {
    lastTextNode = walker.currentNode as Text
  }

  if (!lastTextNode?.textContent?.endsWith(CODE_BLOCK_TRAILING_CARET_SENTINEL)) {
    return null
  }

  const sentinelNode = document.createTextNode(CODE_BLOCK_TRAILING_CARET_SENTINEL)
  const withoutSentinel = lastTextNode.textContent.slice(0, -CODE_BLOCK_TRAILING_CARET_SENTINEL.length)
  lastTextNode.textContent = withoutSentinel
  lastTextNode.parentNode?.insertBefore(sentinelNode, lastTextNode.nextSibling)
  return sentinelNode
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

  selectImage(img)
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
  applyImageSizingMetadata(temp)

  // ---- Merge pasted list items into the list being pasted into ----
  // The pasted list containers are unwrapped so their top-level items become
  // siblings of the current <li>.  Sub-lists travel with their item, so the
  // structure the author copied survives the paste.
  const anchorNode = sel.anchorNode
  const targetLi = anchorNode instanceof HTMLElement
    ? anchorNode.closest('li')
    : anchorNode?.parentElement?.closest('li')

  if (targetLi) {
    const parentList = targetLi.parentElement // the <ul> or <ol>

    repairOrphanedListItems(temp)
    const pastedLists = Array.from(temp.querySelectorAll(':scope > ul, :scope > ol'))
    const plainTextListItems = pastedLists.length === 0 ? parsePlainTextListItems(text) : null
    if (pastedLists.length > 0 || plainTextListItems) {
      const newItems: HTMLLIElement[] = []
      for (const list of pastedLists) {
        // Strip list markers that were pasted as text, at every level
        for (const li of Array.from(list.querySelectorAll('li'))) {
          normalizeListItemElement(li as HTMLLIElement)
        }
        newItems.push(...Array.from(list.querySelectorAll(':scope > li')) as HTMLLIElement[])
        // Remove the list wrapper from the temp — its items will be inserted
        // directly into the parent list
        list.remove()
      }

      if (plainTextListItems) {
        newItems.push(...buildListItemsFromPlainText(plainTextListItems))
      }

      // Any remaining non-list content in temp goes into the current <li>
      // (e.g. plain text that was before/after the pasted list)
      if (!plainTextListItems) {
        const frag = document.createDocumentFragment()
        let lastInline: Node | null = null
        while (temp.firstChild) {
          lastInline = frag.appendChild(temp.firstChild)
        }
        if (frag.childNodes.length > 0) {
          range.insertNode(frag)
        }
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

        // Place the cursor at the end of the last pasted line — that is the
        // deepest last item when the paste brought sub-items along
        const lastLi = newItems[newItems.length - 1] ?? targetLi
        placeCursorAtListItemContentEnd(sel, findDeepestLastListItem(lastLi))
      }

      onInput()
      return
    }
  }

  // ---- Markdown list pasted as plain text outside a list ----
  // Without this the markers survive as literal text and get escaped on
  // serialization (`\- item`), so the list never becomes a list.
  if (!targetLi && !html) {
    const pasteBlock = findPasteTargetBlock(anchorNode)
    const plainTextListItems = parsePlainTextListItems(text)

    if (
      plainTextListItems
      && !isInsideTag('pre')
      && !findClosestCell(anchorNode)
      && (!pasteBlock || /^(P|DIV)$/.test(pasteBlock.tagName))
      && !pasteBlock?.textContent?.trim()
    ) {
      const list = document.createElement(plainTextListItems[0].ordered ? 'ol' : 'ul')
      for (const item of buildListItemsFromPlainText(plainTextListItems)) {
        list.appendChild(item)
      }

      if (pasteBlock) {
        pasteBlock.replaceWith(list)
      } else {
        range.insertNode(list)
      }

      const lastItem = list.lastElementChild as HTMLElement | null
      if (lastItem) placeCursorAtListItemContentEnd(sel, findDeepestLastListItem(lastItem))

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
  // Repair marker-only list items coming from the pasted markup
  repairOrphanedListItems(editorEl.value)

  // Trigger sync
  onInput()
}

function onSelectionChange(): void {
  const selection = window.getSelection()
  const anchorNode = selection?.anchorNode
  const image = anchorNode instanceof HTMLElement
    ? anchorNode.closest('img')
    : anchorNode?.parentElement?.closest('img')

  if (!image) {
    clearImageSelection()
  }
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

interface PlainTextListItem {
  depth: number
  text: string
  ordered: boolean
}

/**
 * Parse clipboard text that is entirely a markdown list.
 *
 * Indentation becomes nesting depth.  The widths themselves are not
 * comparable across sources (two spaces, four spaces, tabs), so every deeper
 * indent opens a level and falling back to a known width closes down to it.
 */
function parsePlainTextListItems(text: string): PlainTextListItem[] | null {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '')

  if (lines.length === 0) return null

  const items: PlainTextListItem[] = []
  const openIndents: number[] = []

  for (const line of lines) {
    const match = line.match(LIST_MARKER_TEXT_RE)
    if (!match) return null

    const indent = match[1].replace(/\t/g, '    ').length
    while (openIndents.length > 0 && indent < openIndents[openIndents.length - 1]) {
      openIndents.pop()
    }
    if (openIndents.length === 0 || indent > openIndents[openIndents.length - 1]) {
      openIndents.push(indent)
    }

    items.push({
      depth: openIndents.length - 1,
      text: match[3],
      ordered: /^\d/.test(match[2]),
    })
  }

  return items
}

/** Build list items — sub-lists included — from parsed plain-text lines. */
function buildListItemsFromPlainText(items: PlainTextListItem[]): HTMLLIElement[] {
  const topLevelItems: HTMLLIElement[] = []
  const openItems: HTMLLIElement[] = []

  for (const item of items) {
    const listItem = createTextListItem(item.text)
    // A line cannot open more than one level at a time
    const depth = Math.min(item.depth, openItems.length)

    if (depth === 0) {
      topLevelItems.push(listItem)
    } else {
      const parentItem = openItems[depth - 1]
      const subList = parentItem.querySelector(':scope > ul, :scope > ol')
        ?? parentItem.appendChild(document.createElement(item.ordered ? 'ol' : 'ul'))
      subList.appendChild(listItem)
    }

    openItems[depth] = listItem
    openItems.length = depth + 1
  }

  return topLevelItems
}

/** The item a pasted block ends on: the deepest last item of its sub-tree. */
function findDeepestLastListItem(listItem: HTMLElement): HTMLElement {
  let current = listItem
  for (;;) {
    const nested = current.querySelector(':scope > ul > li:last-child, :scope > ol > li:last-child')
    if (!nested) return current
    current = nested as HTMLElement
  }
}

/** Closest block the caret sits in, or null at the editor root. */
function findPasteTargetBlock(node: Node | null): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement
  const block = element?.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, li, td, th')
  if (!block || block === editorEl.value || !editorEl.value?.contains(block)) return null
  return block as HTMLElement
}

function createTextListItem(text: string): HTMLLIElement {
  const li = document.createElement('li')
  const normalizedText = stripLeadingListMarker(text).trim()

  if (!normalizedText) {
    li.innerHTML = '<br>'
    return li
  }

  li.textContent = normalizedText
  return li
}

function normalizeListItemElement(li: HTMLLIElement): HTMLLIElement {
  const firstTextNode = findFirstListContentTextNode(li)
  if (firstTextNode) {
    const normalizedText = stripLeadingListMarker(firstTextNode.textContent ?? '')
    if (normalizedText !== firstTextNode.textContent) {
      firstTextNode.textContent = normalizedText
    }
  }

  if (!li.textContent?.trim() && !li.querySelector('ul, ol')) {
    li.innerHTML = '<br>'
  }

  return li
}

function findFirstListContentTextNode(root: Node): Text | null {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      return child as Text
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const childElement = child as HTMLElement
    if (childElement.tagName === 'UL' || childElement.tagName === 'OL') continue

    const nestedTextNode = findFirstListContentTextNode(child)
    if (nestedTextNode) return nestedTextNode
  }

  return null
}

function stripLeadingListMarker(text: string): string {
  const match = text.match(LIST_MARKER_TEXT_RE)
  return match ? match[3] : text
}

/**
 * Check whether a boundary point sits inside the list item's *own* content,
 * i.e. inside the item but not inside one of its nested sub-lists.
 */
function isPointInListItemOwnContent(
  listItem: HTMLLIElement,
  container: Node,
  offset: number,
): boolean {
  if (container === listItem) return offset <= getListItemOwnContentEnd(listItem)
  if (!listItem.contains(container)) return false

  let current: Node | null = container
  while (current && current !== listItem) {
    if (isListElement(current)) return false
    current = current.parentNode
  }
  return true
}

function isSelectionInListItemOwnContent(selection: Selection, listItem: HTMLLIElement): boolean {
  if (selection.rangeCount === 0) return false
  const range = selection.getRangeAt(0)
  return isPointInListItemOwnContent(listItem, range.startContainer, range.startOffset)
    && isPointInListItemOwnContent(listItem, range.endContainer, range.endOffset)
}

/**
 * Range from the caret to the end of the item's own content.  Nested
 * sub-lists are excluded, so items with children are handled the same way as
 * plain ones — markdown rendering leaves whitespace text nodes around the
 * nested `<ul>`, which a node-identity check would mistake for content.
 */
function createListItemContentTailRange(range: Range, listItem: HTMLLIElement): Range {
  const tail = document.createRange()
  tail.setStart(range.endContainer, range.endOffset)
  tail.setEnd(listItem, getListItemOwnContentEnd(listItem))
  return tail
}

function isCollapsedSelectionAtListItemContentEnd(selection: Selection, listItem: HTMLLIElement): boolean {
  if (!selection.isCollapsed || selection.rangeCount === 0) return false

  const tail = createListItemContentTailRange(selection.getRangeAt(0), listItem)
  return !tail.toString().trim() && !tail.cloneContents().querySelector('img')
}

function isCollapsedSelectionAtListItemContentStart(selection: Selection, listItem: HTMLLIElement): boolean {
  if (!selection.isCollapsed || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  const head = document.createRange()
  head.setStart(listItem, 0)
  head.setEnd(range.startContainer, range.startOffset)
  return !head.toString().trim() && !head.cloneContents().querySelector('img')
}

/**
 * Split a list item at the caret: everything after it moves into a new item
 * below.  Nested sub-lists always stay with the original item, so a split can
 * never produce a marker-only item.
 */
function splitListItemAtSelection(selection: Selection, listItem: HTMLLIElement): void {
  const parentList = listItem.parentElement
  if (!parentList) return

  const range = selection.getRangeAt(0)
  if (!selection.isCollapsed) range.deleteContents()

  const tail = createListItemContentTailRange(range, listItem)
  const tailContent = tail.extractContents()

  const newLi = document.createElement('li')
  if (tailContent.textContent?.trim() || tailContent.querySelector('img')) {
    newLi.appendChild(tailContent)
  } else {
    newLi.innerHTML = '<br>'
  }
  parentList.insertBefore(newLi, listItem.nextSibling)

  // Keep the original item editable when the split emptied it
  if (!listItemHasOwnContent(listItem)) {
    listItem.insertBefore(document.createElement('br'), listItem.firstChild)
  }

  placeCursorAtStart(selection, newLi)
}

/** Place the caret at the end of the item's own text, before its sub-list. */
function placeCursorAtListItemContentEnd(selection: Selection, listItem: HTMLElement): void {
  const contentEnd = getListItemOwnContentEnd(listItem)
  const lastNode = listItem.childNodes[contentEnd - 1]
  const range = document.createRange()

  if (lastNode?.nodeType === Node.TEXT_NODE) {
    range.setStart(lastNode, (lastNode.textContent ?? '').length)
  } else {
    range.setStart(listItem, contentEnd)
  }
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Move an item's sub-lists onto `target`, merging with a sub-list it has. */
function transferSubLists(listItem: HTMLElement, target: HTMLElement): void {
  for (const nested of Array.from(listItem.children).filter((child) => isListElement(child))) {
    const existing = target.querySelector(':scope > ul, :scope > ol')
    if (existing && existing.tagName === nested.tagName) {
      while (nested.firstChild) existing.appendChild(nested.firstChild)
      nested.remove()
    } else {
      target.appendChild(nested)
    }
  }
}

/**
 * Delete a list item that has no text of its own, keeping its sub-list where
 * the author would expect it.  Returns `'outdent'` when the item should be
 * lifted a level instead — that is handled by the outdent command.
 */
function removeContentlessListItem(
  selection: Selection,
  listItem: HTMLElement,
): 'handled' | 'outdent' | null {
  const parentList = listItem.parentElement
  if (!parentList || !isListElement(parentList)) return null

  const previousItem = listItem.previousElementSibling
  if (previousItem?.tagName === 'LI') {
    // Its children belonged to the item above before the bullet was emptied
    transferSubLists(listItem, previousItem as HTMLElement)
    listItem.remove()
    placeCursorAtListItemContentEnd(selection, previousItem as HTMLElement)
    return 'handled'
  }

  const grandparentItem = parentList.parentElement
  if (grandparentItem?.tagName === 'LI') {
    if (listItem.querySelector('ul, ol')) return 'outdent'

    listItem.remove()
    if (parentList.children.length === 0) parentList.remove()
    placeCursorAtListItemContentEnd(selection, grandparentItem as HTMLElement)
    return 'handled'
  }

  // First item of a top-level list → leave the list, its children move up
  const paragraph = document.createElement('p')
  paragraph.innerHTML = '<br>'
  for (const nested of Array.from(listItem.children).filter((child) => isListElement(child))) {
    while (nested.firstChild) parentList.insertBefore(nested.firstChild, listItem)
    nested.remove()
  }
  listItem.remove()
  parentList.parentNode?.insertBefore(paragraph, parentList)
  if (parentList.children.length === 0) parentList.remove()
  placeCursorAtStart(selection, paragraph)
  return 'handled'
}

/**
 * Repair list items that only wrap a nested list.  Browsers create them when
 * they split an item that has children; markdown cannot express them.  The
 * item currently holding the caret is left alone so the repair never pulls
 * content away mid-edit.
 */
function normalizeListStructure(): boolean {
  const selection = window.getSelection()
  return repairOrphanedListItems(editorEl.value, {
    protectedNodes: [selection?.anchorNode, selection?.focusNode],
  })
}

function findCodeBlockArrowUpExitTarget(selection: Selection): Node | null {
  if (!editorEl.value || !selection.isCollapsed || selection.rangeCount === 0) return null

  const anchor = selection.anchorNode
  const preEl = anchor instanceof HTMLElement
    ? anchor.closest('pre')
    : anchor?.parentElement?.closest('pre')
  const codeEl = anchor instanceof HTMLElement
    ? anchor.closest('code')
    : anchor?.parentElement?.closest('code')

  if (!preEl || !codeEl || !editorEl.value.contains(preEl)) return null

  const insertionAnchor = findEditorRootAncestor(preEl)
  if (!isFirstMeaningfulEditorChild(insertionAnchor)) return null

  const range = selection.getRangeAt(0)
  const textBeforeCursor = document.createRange()
  textBeforeCursor.setStart(codeEl, 0)
  textBeforeCursor.setEnd(range.startContainer, range.startOffset)

  return textBeforeCursor.toString().includes('\n') ? null : insertionAnchor
}

function isFirstMeaningfulEditorChild(node: Node): boolean {
  let sibling = node.previousSibling

  while (sibling) {
    if (sibling.nodeType === Node.TEXT_NODE && !sibling.textContent?.trim()) {
      sibling = sibling.previousSibling
      continue
    }

    return false
  }

  return true
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

function normalizeEmptyInlineCode(sel: Selection | null): void {
  if (!editorEl.value) return

  let shouldResetEditor = false

  for (const codeEl of Array.from(editorEl.value.querySelectorAll('code'))) {
    if (codeEl.closest('pre')) continue

    const normalizedText = (codeEl.textContent || '')
      .replace(/[\u200B\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim()
    const hasMeaningfulChild = Array.from(codeEl.children).some(
      (child) => child.tagName !== 'BR',
    )

    if (normalizedText || hasMeaningfulChild) continue

    const blockParent = findClosestInlineCodeBlockParent(codeEl)
    const shouldRestoreSelection = !!sel && codeEl.contains(sel.anchorNode)

    codeEl.remove()

    if (blockParent && !hasRenderableContent(blockParent)) {
      blockParent.innerHTML = '<br>'
      if (shouldRestoreSelection && sel) {
        placeCursorAtStart(sel, blockParent)
      }
    }

    if (shouldRestoreSelection) {
      shouldResetEditor = true
    }
  }

  if (shouldResetEditor && !hasRenderableContent(editorEl.value)) {
    editorEl.value.innerHTML = '<p><br></p>'
    if (sel) {
      placeCursorAtStart(sel, editorEl.value.firstElementChild as HTMLElement)
    }
  }
}

function normalizePresentationalInlineArtifacts(): void {
  if (!editorEl.value) return

  const wrappers = Array.from(editorEl.value.querySelectorAll('font, span')) as HTMLElement[]

  for (const el of wrappers) {
    if (el.closest('pre')) continue
    if (el.classList.contains('ce-code-lang') || el.classList.contains('ce-code-lang-input')) continue

    const shouldUnwrap = el.tagName === 'FONT'
      || (el.tagName === 'SPAN' && el.hasAttribute('style'))

    if (!shouldUnwrap) continue

    unwrapElementPreservingChildren(el)
  }
}

function findClosestInlineCodeBlockParent(codeEl: HTMLElement): HTMLElement | null {
  let blockParent: HTMLElement | null = codeEl.parentElement

  while (blockParent && blockParent !== editorEl.value) {
    if (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|TD|TH)$/.test(blockParent.tagName)) {
      return blockParent
    }
    blockParent = blockParent.parentElement
  }

  return null
}

function hasRenderableContent(el: HTMLElement): boolean {
  const normalizedText = (el.textContent || '')
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()

  return !!normalizedText || !!el.querySelector('img, br')
}

function unwrapElementPreservingChildren(el: HTMLElement): void {
  const parent = el.parentNode
  if (!parent) return

  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el)
  }

  el.remove()
}
</script>
