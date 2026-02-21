<template>
  <div class="cliveedit ce-viewer" :class="{ 'ce-viewer--bordered': bordered }">
    <div class="ce-viewer__content" v-html="renderedHtml" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { parseMarkdown } from '@/utils/markdown'
import { useInjectHighlight } from '@/composables/useHighlighter'
import { initHighlighter, highlightCode, isHighlighterReady } from '@/utils/highlighter'
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
}

const props = withDefaults(defineProps<MarkdownViewerProps>(), {
  bordered: true,
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

  return parseMarkdown(props.modelValue, {
    highlight: hlFn ?? undefined,
  })
})
</script>
