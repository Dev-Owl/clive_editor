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
  })

  return props.codeCopyButton ? addCodeCopyButtons(html) : html
})

/* ---- Copy to clipboard ---- */

// The rendered markup is injected with v-html, so the buttons cannot carry
// Vue listeners — the clicks are picked up on the content element instead.
function onContentClick(event: MouseEvent): void {
  const button = findCopyButton(event.target)
  if (button) copyCodeBlock(button)
}

onBeforeUnmount(clearCopyFeedback)
</script>
