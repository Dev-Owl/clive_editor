/* ================================================================== */
/*  useHistory — undo / redo stack composable                          */
/* ================================================================== */

import { ref, computed } from 'vue'
import type { HistoryEntry } from '@/types'

export interface UseHistoryOptions {
  /** Maximum number of entries kept (default 100) */
  maxDepth?: number
  /** Debounce interval in ms for keyboard input (default 300) */
  debounceMs?: number
}

export function useHistory(options: UseHistoryOptions = {}) {
  const maxDepth = options.maxDepth ?? 100
  const debounceMs = options.debounceMs ?? 300

  const undoStack = ref<HistoryEntry[]>([])
  const redoStack = ref<HistoryEntry[]>([])

  const canUndo = computed(() => undoStack.value.length > 1)
  const canRedo = computed(() => redoStack.value.length > 0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  /* ---- push (debounced — for keystrokes) ---- */

  function pushState(markdown: string): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      _push(markdown)
    }, debounceMs)
  }

  /* ---- pushImmediate (for toolbar actions & mode switches) ---- */

  function pushImmediate(markdown: string): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    _push(markdown)
  }

  /* ---- internal push ---- */

  function _push(markdown: string): void {
    // Don't push if identical to current top
    const top = undoStack.value[undoStack.value.length - 1]
    if (top && top.markdown === markdown) return

    undoStack.value.push({
      markdown,
      timestamp: Date.now(),
    })

    // Trim to max depth
    if (undoStack.value.length > maxDepth) {
      undoStack.value.splice(0, undoStack.value.length - maxDepth)
    }

    // New edit clears redo
    redoStack.value = []
  }

  /* ---- undo ---- */

  function undo(): HistoryEntry | null {
    if (!canUndo.value) return null

    const current = undoStack.value.pop()!
    redoStack.value.push(current)

    const previous = undoStack.value[undoStack.value.length - 1]
    return previous ?? null
  }

  /* ---- redo ---- */

  function redo(): HistoryEntry | null {
    if (!canRedo.value) return null

    const entry = redoStack.value.pop()!
    undoStack.value.push(entry)
    return entry
  }

  /* ---- initialise with first state ---- */

  function init(markdown: string): void {
    undoStack.value = [{ markdown, timestamp: Date.now() }]
    redoStack.value = []
  }

  /* ---- clear ---- */

  function clear(): void {
    undoStack.value = []
    redoStack.value = []
    if (debounceTimer) clearTimeout(debounceTimer)
  }

  return {
    pushState,
    pushImmediate,
    undo,
    redo,
    canUndo,
    canRedo,
    init,
    clear,
  }
}
