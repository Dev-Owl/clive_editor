import type { Component } from 'vue'

/* ------------------------------------------------------------------ */
/*  Editor Mode                                                        */
/* ------------------------------------------------------------------ */

export type EditorMode = 'wysiwyg' | 'markdown'

/* ------------------------------------------------------------------ */
/*  Toolbar                                                            */
/* ------------------------------------------------------------------ */

export interface ToolbarItem {
  /** Unique identifier, e.g. "bold", "heading1" */
  id: string
  /** Human readable label (used for aria-label / tooltip) */
  label: string
  /** Lucide icon component -or- a custom Vue component */
  icon: Component
  /** Editor action to invoke (matches method names on EditorContext) */
  action: string
  /** Optional keyboard shortcut label, e.g. "Ctrl+B" */
  shortcut?: string
  /** Return true when the formatting is active at the current cursor */
  active?: (ctx: EditorContext) => boolean
  /** Optional group divider — when true a separator is rendered before this item */
  divider?: boolean
}

/* ------------------------------------------------------------------ */
/*  History                                                            */
/* ------------------------------------------------------------------ */

export interface HistoryEntry {
  /** Raw markdown content */
  markdown: string
  /** Timestamp (Date.now()) */
  timestamp: number
  /** Serialised cursor / selection offsets (optional) */
  selectionStart?: number
  selectionEnd?: number
}

/* ------------------------------------------------------------------ */
/*  Props & Emits                                                      */
/* ------------------------------------------------------------------ */

export interface HighlightOptions {
  /** Shiki theme name for light mode (default: 'github-light') */
  theme?: string
  /** Shiki theme name for dark mode (default: 'github-dark') */
  darkTheme?: string
  /** Languages to pre-load (default: common web languages) */
  langs?: string[]
  /** When true, uses the dark theme for syntax highlighting */
  darkMode?: boolean
}

export interface CliveEditProps {
  /** Raw markdown string (v-model) */
  modelValue: string
  /** Current editing mode */
  mode?: EditorMode
  /** Placeholder text shown when editor is empty */
  placeholder?: string
  /** Disable all editing */
  disabled?: boolean
  /** Override the default toolbar items */
  toolbarItems?: ToolbarItem[]
  /** Maximum number of undo history entries (default 100) */
  historyDepth?: number
  /**
   * Keep the toolbar pinned at the top of the viewport when scrolling.
   * Enabled by default to support long documents.
   * Set to `false` to let the toolbar scroll with the content.
   */
  stickyToolbar?: boolean
  /**
   * Enable syntax highlighting in code blocks via Shiki.
   * Requires `shiki` to be installed as a peer dependency.
   * Pass `{}` to use defaults (github-light theme, common languages).
   */
  highlightOptions?: HighlightOptions
}

export type CliveEditEmits = {
  /** v-model update */
  'update:modelValue': [value: string]
  /** Mode switch */
  'update:mode': [mode: EditorMode]
}

/* ------------------------------------------------------------------ */
/*  Editor Context  (provide / inject)                                 */
/* ------------------------------------------------------------------ */

export interface EditorContext {
  /* --- state ---- */
  mode: EditorMode
  disabled: boolean

  /* --- formatting commands (WYSIWYG) ---- */
  bold: () => void
  italic: () => void
  strikethrough: () => void
  heading: (level: 1 | 2 | 3) => void
  bulletList: () => void
  orderedList: () => void
  indentList: () => void
  outdentList: () => void
  blockquote: () => void
  codeInline: () => void
  codeBlock: (lang?: string) => void
  link: (url?: string, text?: string) => void
  image: (src?: string, alt?: string) => void
  horizontalRule: () => void
  table: () => void

  /* --- history ---- */
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  /* --- mode ---- */
  toggleMode: () => void

  /* --- query ---- */
  isActive: (tag: string) => boolean
}

/** Injection key */
export const EDITOR_CTX_KEY = Symbol('cliveedit-context') as InjectionKey<EditorContext>

// Re-export Vue's InjectionKey so consumers don't need to import it
import type { InjectionKey } from 'vue'
