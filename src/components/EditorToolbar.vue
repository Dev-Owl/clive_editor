<template>
  <div class="ce-toolbar" role="toolbar" aria-label="Formatting toolbar">
    <template v-for="(item, index) in items" :key="item.id">
      <!-- Divider -->
      <span v-if="item.divider && index > 0" class="ce-toolbar__divider" aria-hidden="true" />

      <!-- Button -->
      <button
        type="button"
        class="ce-toolbar__btn"
        :class="{ 'ce-toolbar__btn--active': item.active?.(ctx) }"
        :aria-label="item.label"
        :title="item.shortcut ? `${item.label} (${item.shortcut})` : item.label"
        :disabled="disabled"
        @click="handleAction(item)"
      >
        <component :is="item.icon" :size="18" />
      </button>
    </template>

    <!-- Spacer pushes the mode toggle to the right -->
    <span class="ce-toolbar__spacer" />

    <!-- Mode toggle -->
    <button
      type="button"
      class="ce-toolbar__btn ce-toolbar__mode-btn"
      :aria-label="mode === 'wysiwyg' ? 'Switch to Markdown mode' : 'Switch to Visual mode'"
      :title="mode === 'wysiwyg' ? 'Markdown mode' : 'Visual mode'"
      :disabled="disabled"
      @click="$emit('toggle-mode')"
    >
      <component :is="mode === 'wysiwyg' ? FileCode : Eye" :size="18" />
      <span>{{ mode === 'wysiwyg' ? 'MD' : 'Visual' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileCode, Eye } from 'lucide-vue-next'
import { defaultToolbarItems } from '@/commands'
import type { ToolbarItem, BuiltInToolbarItem, ToolbarAction, EditorContext, EditorMode } from '@/types'

/* ---- Props / Emits ---- */

const props = defineProps<{
  mode: EditorMode
  disabled?: boolean
  customItems?: ToolbarItem[]
  ctx: EditorContext
  enableEmoji?: boolean
}>()

const emit = defineEmits<{
  action: [actionName: ToolbarAction, ...args: unknown[]]
  'toggle-mode': []
}>()

const items = computed(() => {
  const base = props.customItems ?? defaultToolbarItems
  if (props.enableEmoji) return base
  // Filter out emoji item when the feature is not enabled
  return base.filter((item) => !isBuiltInItem(item) || item.action !== 'emoji')
})

/* ---- Action dispatch ---- */

function handleAction(item: ToolbarItem): void {
  if (isBuiltInItem(item)) {
    emit('action', item.action)
    return
  }

  item.onClick(props.ctx)
}

function isBuiltInItem(item: ToolbarItem): item is BuiltInToolbarItem {
  return 'action' in item
}
</script>
