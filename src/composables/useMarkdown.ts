/* ================================================================== */
/*  useMarkdown — two-way sync between markdown and WYSIWYG HTML      */
/* ================================================================== */

import { watch, ref, type Ref } from 'vue'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'

export interface UseMarkdownOptions {
  /**
   * The raw markdown string (v-model).
   * We receive a getter+setter pair via the component.
   */
  modelValue: Ref<string>
  /** Emit function for update:modelValue */
  emit: (value: string) => void
  /** Ref to the contenteditable element */
  editorRef: Ref<HTMLElement | null>
  /** Called after HTML is injected (e.g. to push history) */
  onContentChange?: (markdown: string) => void
}

export function useMarkdown(options: UseMarkdownOptions) {
  const { modelValue, emit, editorRef, onContentChange } = options

  /** Guard flag to prevent sync loops */
  const isSyncing = ref(false)

  /** Debounce timer for serialisation */
  let serializeTimer: ReturnType<typeof setTimeout> | null = null

  /* ---- modelValue → HTML (prop changed externally) ---- */

  watch(
    modelValue,
    (md) => {
      if (isSyncing.value) return
      const el = editorRef.value
      if (!el) return

      isSyncing.value = true
      el.innerHTML = parseMarkdown(md)
      isSyncing.value = false
    },
    { immediate: true },
  )

  /* ---- HTML → modelValue (user typed in WYSIWYG) ---- */

  function handleInput(): void {
    if (isSyncing.value) return

    if (serializeTimer) clearTimeout(serializeTimer)
    serializeTimer = setTimeout(() => {
      const el = editorRef.value
      if (!el) return

      isSyncing.value = true
      const md = serializeHtml(el.innerHTML)
      emit(md)
      onContentChange?.(md)
      isSyncing.value = false
    }, 80) // short debounce for serialisation perf
  }

  /**
   * Force-sync: convert the current editor HTML to markdown and emit.
   * Used before mode switches and toolbar actions.
   */
  function syncNow(): string {
    const el = editorRef.value
    if (!el) return modelValue.value

    if (serializeTimer) clearTimeout(serializeTimer)
    isSyncing.value = true
    const md = serializeHtml(el.innerHTML)
    emit(md)
    isSyncing.value = false
    return md
  }

  /**
   * Force-refresh: re-render the HTML from the current modelValue.
   * Used after undo/redo or mode switch back to WYSIWYG.
   */
  function refreshHtml(): void {
    const el = editorRef.value
    if (!el) return
    isSyncing.value = true
    el.innerHTML = parseMarkdown(modelValue.value)
    isSyncing.value = false
  }

  return {
    handleInput,
    syncNow,
    refreshHtml,
    isSyncing,
  }
}
