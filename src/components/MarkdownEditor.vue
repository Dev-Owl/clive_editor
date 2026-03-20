<template>
  <textarea
    ref="textareaEl"
    class="ce-markdown"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    spellcheck="false"
    aria-label="Markdown source editor"
    @input="onInput"
    @keydown="onKeydown"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { insertTextareaSyntax } from '@/utils/selection'

/* ---- Props / Emits ---- */

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/* ---- Refs ---- */

const textareaEl = ref<HTMLTextAreaElement | null>(null)
const LIST_MARKER_RE = /^(\s*)([-+*]|\d+\.)(\s+)/
const LIST_INDENT = '    '

/* ---- Expose ---- */

defineExpose({
  el: textareaEl,
  focus: () => textareaEl.value?.focus(),

  /**
   * Insert markdown syntax around the current selection.
   * E.g. insertSyntax('**', '**') for bold.
   */
  insertSyntax: (before: string, after: string): void => {
    const ta = textareaEl.value
    if (!ta) return
    const newValue = insertTextareaSyntax(ta, before, after)
    emit('update:modelValue', newValue)
  },

  /**
   * Insert a block of text at the cursor (e.g. for HR, code block).
   */
  insertBlock: (block: string): void => {
    const ta = textareaEl.value
    if (!ta) return
    const start = ta.selectionStart
    const text = ta.value
    const newValue = text.slice(0, start) + block + text.slice(start)
    emit('update:modelValue', newValue)
    // Place cursor after inserted block
    const newPos = start + block.length
    requestAnimationFrame(() => {
      ta.selectionStart = newPos
      ta.selectionEnd = newPos
      ta.focus()
    })
  },

  indentList: (): void => {
    transformSelectedListLines('indent')
  },

  outdentList: (): void => {
    transformSelectedListLines('outdent')
  },
})

/* ---- Event handlers ---- */

function onInput(e: Event): void {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

function onKeydown(e: KeyboardEvent): void {
  if (props.disabled || e.key !== 'Tab') return

  const changed = transformSelectedListLines(e.shiftKey ? 'outdent' : 'indent')
  if (changed) {
    e.preventDefault()
  }
}

function transformSelectedListLines(direction: 'indent' | 'outdent'): boolean {
  const ta = textareaEl.value
  if (!ta) return false

  const text = ta.value
  const selectionStart = ta.selectionStart
  const selectionEnd = ta.selectionEnd
  const blockStart = getLineStart(text, selectionStart)
  const lineAnchor = selectionEnd > selectionStart ? selectionEnd - 1 : selectionEnd
  const blockEnd = getLineEnd(text, lineAnchor)
  const lines = text.slice(blockStart, blockEnd).split('\n')
  const allLines = text.split('\n')
  const startLineIndex = text.slice(0, blockStart).split('\n').length - 1

  let nextSelectionStart = selectionStart
  let nextSelectionEnd = selectionEnd
  let lineOffset = blockStart
  let changed = false

  const transformedLines = lines.map((line, index) => {
    const absoluteIndex = startLineIndex + index
    const nextLine = transformListLine(allLines, absoluteIndex, direction)
    const diff = nextLine.length - line.length

    if (diff !== 0) {
      changed = true
      if (lineOffset <= selectionStart) nextSelectionStart += diff
      if (lineOffset <= selectionEnd) nextSelectionEnd += diff
    }

    allLines[absoluteIndex] = nextLine
    lineOffset += line.length + 1
    return nextLine
  })

  if (!changed) return false

  const newValue = text.slice(0, blockStart) + transformedLines.join('\n') + text.slice(blockEnd)
  emit('update:modelValue', newValue)

  requestAnimationFrame(() => {
    ta.selectionStart = nextSelectionStart
    ta.selectionEnd = nextSelectionEnd
    ta.focus()
  })

  return true
}

function transformListLine(lines: string[], lineIndex: number, direction: 'indent' | 'outdent'): string {
  const line = lines[lineIndex]
  const item = parseListItem(line)
  if (!item) return line

  if (direction === 'indent') {
    if (!canIndentListItem(lines, lineIndex, item)) return line
    return `${LIST_INDENT}${line}`
  }

  if (item.indent.length === 0) return line
  return line.slice(Math.min(item.indent.length, LIST_INDENT.length))
}

function canIndentListItem(lines: string[], lineIndex: number, currentItem: ListItemMeta): boolean {
  for (let i = lineIndex - 1; i >= 0; i--) {
    const line = lines[i]
    const previousItem = parseListItem(line)

    if (!previousItem) {
      if (!line.trim()) continue
      if (getLeadingWhitespace(line).length > currentItem.indent.length) continue
      return false
    }

    if (previousItem.indent.length > currentItem.indent.length) continue
    if (previousItem.indent.length < currentItem.indent.length) return false
    return previousItem.family === currentItem.family
  }

  return false
}

interface ListItemMeta {
  indent: string
  family: 'ordered' | 'unordered'
}

function parseListItem(line: string): ListItemMeta | null {
  const match = line.match(LIST_MARKER_RE)
  if (!match) return null

  const marker = match[2]
  const family = /\d+\./.test(marker) ? 'ordered' : 'unordered'

  return {
    indent: match[1],
    family,
  }
}

function getLeadingWhitespace(line: string): string {
  const match = line.match(/^(\s*)/)
  return match?.[1] ?? ''
}

function getLineStart(text: string, index: number): number {
  if (index <= 0) return 0
  return text.lastIndexOf('\n', index - 1) + 1
}

function getLineEnd(text: string, index: number): number {
  const lineEnd = text.indexOf('\n', index)
  return lineEnd === -1 ? text.length : lineEnd
}
</script>
