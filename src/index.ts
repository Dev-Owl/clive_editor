/* ================================================================== */
/*  CliveEdit — Public API                                             */
/* ================================================================== */

// Main component
export { default as CliveEdit } from './components/CliveEdit.vue'

// Viewer component (read-only markdown renderer)
export { default as MarkdownViewer } from './components/MarkdownViewer.vue'
export type { MarkdownViewerProps } from './components/MarkdownViewer.vue'

// Composables (for advanced / headless usage)
export { useHistory } from './composables/useHistory'
export { useEditor } from './composables/useEditor'
export { useHighlighter, useInjectHighlight } from './composables/useHighlighter'
export type { HighlightFn } from './composables/useHighlighter'

// Types
export type {
  EditorMode,
  ToolbarItem,
  HistoryEntry,
  CliveEditProps,
  CliveEditEmits,
  EditorContext,
  HighlightOptions,
} from './types'
export { EDITOR_CTX_KEY } from './types'

// Vue plugin
export { CliveEditPlugin } from './plugin'
