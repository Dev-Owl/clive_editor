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
})

/* ---- Event handlers ---- */

function onInput(e: Event): void {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>
