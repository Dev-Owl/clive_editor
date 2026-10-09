<template>
  <div class="cliveedit ce-viewer" :class="{ 'ce-viewer--bordered': bordered }">
    <div class="ce-viewer__content" v-html="renderedHtml" @click="onContentClick" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { parseMarkdown } from '@/utils/markdown'
import { useInjectHighlight } from '@/composables/useHighlighter'
import { initHighlighter, highlightCode, isHighlighterReady } from '@/utils/highlighter'
import {
  addCodeCopyButtons,
  copyCodeBlock,
  clearCopyFeedback,
  findCopyButton,
} from '@/utils/codeCopy'
import type { HighlightOptions } from '@/types'
import type { SanitizeFn } from '@/utils/renderSanitizer'

/* ---- Props ---- */

export interface MarkdownViewerProps {
  /** Raw markdown string to render */
  modelValue: string
  /** Show a border around the viewer (default true) */
  bordered?: boolean
  /**
   * Enable syntax highlighting in code blocks via Shiki.
   * When used standalone (outside CliveEdit), pass this prop directly.
   * When used inside CliveEdit, highlighting is injected automatically.
   */
  highlightOptions?: HighlightOptions
  /**
   * Show a button on every code block that copies its content to the
   * clipboard (default true). Viewer only — the editor never shows it.
   */
  codeCopyButton?: boolean
  /**
   * Replaces the default sanitiser for the rendered HTML
   * (default: DOMPurify via `sanitizeRenderedHtml`).
   */
  sanitize?: SanitizeFn
}

const props = withDefaults(defineProps<MarkdownViewerProps>(), {
  bordered: true,
  codeCopyButton: true,
})

/* ---- Syntax highlighting ---- */

// Try injecting from a parent CliveEdit
const injectedHighlightFn = useInjectHighlight()

// Local highlighter for standalone usage
const localReady = ref(isHighlighterReady())

onMounted(() => {
  if (props.highlightOptions && !injectedHighlightFn.value && !localReady.value) {
    initHighlighter(props.highlightOptions).then((ok) => {
      if (ok) localReady.value = true
    })
  }
})

watch(
  () => props.highlightOptions,
  (opts) => {
    if (opts && !injectedHighlightFn.value && !localReady.value) {
      initHighlighter(opts).then((ok) => {
        if (ok) localReady.value = true
      })
    }
  },
  { deep: true },
)

/* ---- Rendered HTML ---- */

const renderedHtml = computed(() => {
  // Prefer injected highlight (from parent CliveEdit), fall back to local
  const hlFn = injectedHighlightFn.value
    ?? (localReady.value
      ? (code: string, lang: string) => highlightCode(code, lang, !!props.highlightOptions?.darkMode)
      : undefined)

  const html = parseMarkdown(props.modelValue, {
    highlight: hlFn ?? undefined,
    sanitize: props.sanitize,
  })

  return props.codeCopyButton ? addCodeCopyButtons(html) : html
})

/* ---- Copy to clipboard ---- */

// The rendered markup is injected with v-html, so the buttons cannot carry
// Vue listeners — the clicks are picked up on the content element instead.
function onContentClick(event: MouseEvent): void {
  const button = findCopyButton(event.target)
  if (button) {
    copyCodeBlock(button)
    return
  }
  jumpToAnchor(event)
}

/* ---- In-document links ---- */

// Heading ids repeat when the same document is rendered more than once on a
// page (e.g. editor and preview side by side), and the browser always jumps
// to the first match. In-document links therefore scroll within this viewer.
function jumpToAnchor(event: MouseEvent): void {
  // Leave modified clicks (new tab / window) to the browser
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  if (!(event.target instanceof Element) || !(event.currentTarget instanceof Element)) return

  const anchor = event.target.closest('a')
  const href = anchor?.getAttribute('href')
  if (!href?.startsWith('#') || href.length < 2) return

  const target = event.currentTarget.querySelector(
    `[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`,
  )
  if (!target) return

  event.preventDefault()
  // Keep the URL shareable and the back button working
  if (location.hash !== href) history.pushState(history.state, '', href)
  target.scrollIntoView({ block: 'start' })
}

onBeforeUnmount(clearCopyFeedback)
</script>
