<template>
  <div class="cliveedit ce-viewer" :class="{ 'ce-viewer--bordered': bordered }">
    <div class="ce-viewer__content" v-html="renderedHtml" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkdown } from '@/utils/markdown'

/* ---- Props ---- */

export interface MarkdownViewerProps {
  /** Raw markdown string to render */
  modelValue: string
  /** Show a border around the viewer (default true) */
  bordered?: boolean
}

const props = withDefaults(defineProps<MarkdownViewerProps>(), {
  bordered: true,
})

/* ---- Rendered HTML ---- */

const renderedHtml = computed(() => parseMarkdown(props.modelValue))
</script>
