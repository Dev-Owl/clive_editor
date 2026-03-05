<template>
  <div
    v-if="visible"
    ref="panelRef"
    class="ce-emoji-picker"
    :style="positionStyle"
  >
    <div ref="mountRef" class="ce-emoji-picker__mount" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick, type CSSProperties } from 'vue'
import { createPickerElement, type EmojiPickerOptions } from '@/utils/emojiPicker'

/* ---- Props / Emits ---- */

const props = defineProps<{
  visible: boolean
  anchorEl?: HTMLElement | null
  options?: EmojiPickerOptions
}>()

const emit = defineEmits<{
  select: [unicode: string]
  close: []
}>()

/* ---- Refs ---- */

const panelRef = ref<HTMLElement | null>(null)
const mountRef = ref<HTMLElement | null>(null)
const positionStyle = ref<CSSProperties>({})

let pickerEl: HTMLElement | null = null
let outsideListener: ((e: PointerEvent) => void) | null = null
let escListener: ((e: KeyboardEvent) => void) | null = null

/* ---- Lifecycle ---- */

watch(() => props.visible, async (show) => {
  if (show) {
    await nextTick()
    mountPicker()
    updatePosition()
    addGlobalListeners()
  } else {
    removeGlobalListeners()
  }
})

onBeforeUnmount(() => {
  removeGlobalListeners()
  destroyPicker()
})

/* ---- Picker mounting ---- */

function mountPicker(): void {
  if (!mountRef.value) return

  // Re-use existing picker or create a fresh one
  if (!pickerEl) {
    pickerEl = createPickerElement(props.options)
    if (!pickerEl) return
    pickerEl.addEventListener('emoji-click', onEmojiClick as EventListener)
  }

  // Auto-detect dark mode from the editor's background colour
  const isDark = detectEditorDarkMode()
  pickerEl.classList.remove('dark', 'light')
  pickerEl.classList.add(isDark ? 'dark' : 'light')

  // Append if not already a child
  if (!mountRef.value.contains(pickerEl)) {
    mountRef.value.appendChild(pickerEl)
  }

  // Copy the editor's --ce-* CSS variable values onto the panel as inline
  // styles so that the CSS variable bridge works even though the panel is
  // teleported to <body> (outside the .cliveedit subtree).
  bridgeEditorVariables()
}

function destroyPicker(): void {
  if (pickerEl) {
    pickerEl.removeEventListener('emoji-click', onEmojiClick as EventListener)
    pickerEl.remove()
    pickerEl = null
  }
}

/* ---- Event handlers ---- */

function onEmojiClick(event: CustomEvent): void {
  const unicode: string | undefined = event.detail?.unicode
  if (unicode) {
    emit('select', unicode)
  }
}

/* ---- Positioning ---- */

function updatePosition(): void {
  if (!props.anchorEl || !panelRef.value) return

  const anchorRect = props.anchorEl.getBoundingClientRect()

  // Use fixed positioning relative to the viewport (panel is teleported to <body>)
  let top = anchorRect.bottom + 4
  let left = anchorRect.left

  // Ensure the picker doesn't overflow the right edge of the viewport
  const pickerWidth = 352
  const viewportWidth = window.innerWidth
  if (left + pickerWidth > viewportWidth) {
    left = Math.max(8, viewportWidth - pickerWidth - 8)
  }

  // Ensure it doesn't overflow the bottom
  const pickerHeight = 324
  const viewportHeight = window.innerHeight
  if (top + pickerHeight > viewportHeight) {
    // Show above the button instead
    top = Math.max(8, anchorRect.top - pickerHeight - 4)
  }

  positionStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

/* ---- Global listeners ---- */

function addGlobalListeners(): void {
  outsideListener = (e: PointerEvent) => {
    if (
      panelRef.value &&
      !panelRef.value.contains(e.target as Node) &&
      !(props.anchorEl && props.anchorEl.contains(e.target as Node))
    ) {
      emit('close')
    }
  }
  escListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      emit('close')
    }
  }
  // Use a slight delay so the current click doesn't immediately close it
  setTimeout(() => {
    document.addEventListener('pointerdown', outsideListener!)
    document.addEventListener('keydown', escListener!, true)
  }, 0)
}

function removeGlobalListeners(): void {
  if (outsideListener) {
    document.removeEventListener('pointerdown', outsideListener)
    outsideListener = null
  }
  if (escListener) {
    document.removeEventListener('keydown', escListener, true)
    escListener = null
  }
}

/**
 * Detect whether the editor is in dark mode by computing the luminance
 * of its resolved --ce-bg CSS variable (or background-color fallback).
 * Returns true when the background is dark (luminance < 0.4).
 */
function detectEditorDarkMode(): boolean {
  const editorEl = props.anchorEl?.closest('.cliveedit') as HTMLElement | null
  if (!editorEl) return false

  const style = getComputedStyle(editorEl)
  // Try the --ce-bg custom property first, fall back to background-color
  let raw = style.getPropertyValue('--ce-bg').trim()
  if (!raw) {
    raw = style.backgroundColor
  }
  return luminanceFromCss(raw) < 0.4
}

function luminanceFromCss(color: string): number {
  // Use a temporary element to let the browser resolve any CSS color value
  const el = document.createElement('span')
  el.style.display = 'none'
  el.style.color = color
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  el.remove()

  // getComputedStyle always returns rgb(r, g, b) or rgba(r, g, b, a)
  const m = computed.match(/\d+/g)
  if (!m || m.length < 3) return 1 // fallback to light
  const [r, g, b] = m.map(Number)
  // Relative luminance (ITU-R BT.709)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * Copy the resolved --ce-* CSS variable values from the .cliveedit element
 * onto the teleported panel wrapper so the CSS variable bridge in editor.css
 * can reference them (the panel is outside the .cliveedit subtree).
 */
const CE_VARS = [
  '--ce-bg',
  '--ce-text',
  '--ce-border',
  '--ce-toolbar-btn-active',
  '--ce-toolbar-btn-hover',
  '--ce-focus-ring',
  '--ce-link-color',
]

function bridgeEditorVariables(): void {
  const editorEl = props.anchorEl?.closest('.cliveedit') as HTMLElement | null
  if (!editorEl || !panelRef.value) return

  const editorStyle = getComputedStyle(editorEl)
  for (const varName of CE_VARS) {
    const val = editorStyle.getPropertyValue(varName).trim()
    if (val) {
      panelRef.value.style.setProperty(varName, val)
    }
  }
}
</script>
