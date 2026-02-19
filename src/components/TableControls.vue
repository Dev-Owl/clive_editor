<template>
  <div
    v-if="visible"
    class="ce-table-controls"
    :style="positionStyle"
    @mousedown.prevent
  >
    <!-- Row controls -->
    <div class="ce-table-controls__group">
      <span class="ce-table-controls__label">Row</span>
      <button
        type="button"
        class="ce-table-controls__btn"
        title="Add row above"
        @click="onAddRowAbove"
      >
        <component :is="ArrowUp" :size="14" />
        <component :is="Plus" :size="10" />
      </button>
      <button
        type="button"
        class="ce-table-controls__btn"
        title="Add row below"
        @click="onAddRowBelow"
      >
        <component :is="ArrowDown" :size="14" />
        <component :is="Plus" :size="10" />
      </button>
      <button
        type="button"
        class="ce-table-controls__btn ce-table-controls__btn--danger"
        title="Remove row"
        :disabled="!canRemoveRow"
        @click="onRemoveRow"
      >
        <component :is="ArrowDown" :size="14" />
        <component :is="Minus" :size="10" />
      </button>
    </div>

    <span class="ce-table-controls__divider" />

    <!-- Column controls -->
    <div class="ce-table-controls__group">
      <span class="ce-table-controls__label">Col</span>
      <button
        type="button"
        class="ce-table-controls__btn"
        title="Add column left"
        @click="onAddColumnLeft"
      >
        <component :is="ArrowLeft" :size="14" />
        <component :is="Plus" :size="10" />
      </button>
      <button
        type="button"
        class="ce-table-controls__btn"
        title="Add column right"
        @click="onAddColumnRight"
      >
        <component :is="ArrowRight" :size="14" />
        <component :is="Plus" :size="10" />
      </button>
      <button
        type="button"
        class="ce-table-controls__btn ce-table-controls__btn--danger"
        title="Remove column"
        :disabled="!canRemoveColumn"
        @click="onRemoveColumn"
      >
        <component :is="ArrowRight" :size="14" />
        <component :is="Minus" :size="10" />
      </button>
    </div>

    <span class="ce-table-controls__divider" />

    <!-- Delete entire table -->
    <button
      type="button"
      class="ce-table-controls__btn ce-table-controls__btn--danger"
      title="Delete table"
      @click="onDeleteTable"
    >
      <component :is="Trash2" :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from 'lucide-vue-next'
import { findClosestCell } from '@/utils/selection'
import {
  addRowAbove,
  addRowBelow,
  removeRow,
  addColumnLeft,
  addColumnRight,
  removeColumn,
  getColumnCount,
  getRowCount,
} from '@/utils/tableOps'

/* ---- Props / Emits ---- */

const props = defineProps<{
  editorEl: HTMLElement | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: []
}>()

/* ---- State ---- */

const visible = ref(false)
const activeCell = ref<HTMLTableCellElement | null>(null)
const positionStyle = ref<Record<string, string>>({})

const canRemoveRow = computed(() => {
  if (!activeCell.value) return false
  const table = activeCell.value.closest('table') as HTMLTableElement | null
  if (!table) return false
  // Can't remove header row; need at least 1 body row
  const row = activeCell.value.closest('tr')
  if (row?.parentElement?.tagName === 'THEAD') return false
  const tbody = table.querySelector('tbody')
  return tbody ? tbody.querySelectorAll('tr').length > 1 : false
})

const canRemoveColumn = computed(() => {
  if (!activeCell.value) return false
  const table = activeCell.value.closest('table') as HTMLTableElement | null
  if (!table) return false
  return getColumnCount(table) > 1
})

/* ---- Position the controls above the active table ---- */

function updatePosition(): void {
  if (!activeCell.value || !props.editorEl) {
    visible.value = false
    return
  }

  const table = activeCell.value.closest('table')
  if (!table) {
    visible.value = false
    return
  }

  const editorRect = props.editorEl.getBoundingClientRect()
  const tableRect = table.getBoundingClientRect()

  positionStyle.value = {
    top: `${tableRect.top - editorRect.top - 36}px`,
    left: `${tableRect.left - editorRect.left}px`,
  }
  visible.value = true
}

/* ---- Selection tracking ---- */

function onSelectionChange(): void {
  if (props.disabled || !props.editorEl) {
    visible.value = false
    return
  }

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    visible.value = false
    activeCell.value = null
    return
  }

  // Check if the cursor is inside the editor
  if (!props.editorEl.contains(sel.anchorNode)) {
    visible.value = false
    activeCell.value = null
    return
  }

  const cell = findClosestCell(sel.anchorNode, sel.anchorOffset)
  if (cell && props.editorEl.contains(cell)) {
    activeCell.value = cell
    nextTick(() => updatePosition())
  } else {
    activeCell.value = null
    visible.value = false
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', onSelectionChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
})

/* ---- Watch disabled ---- */

watch(() => props.disabled, (d) => {
  if (d) {
    visible.value = false
    activeCell.value = null
  }
})

/* ---- Actions ---- */

function focusCellAndEmit(cell: HTMLTableCellElement | null): void {
  if (cell) {
    const sel = window.getSelection()
    if (sel) {
      const range = document.createRange()
      range.selectNodeContents(cell)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    activeCell.value = cell
  }
  nextTick(() => updatePosition())
  emit('change')
}

function onAddRowAbove(): void {
  if (!activeCell.value) return
  const newRow = addRowAbove(activeCell.value)
  focusCellAndEmit(newRow?.cells[0] ?? null)
}

function onAddRowBelow(): void {
  if (!activeCell.value) return
  const newRow = addRowBelow(activeCell.value)
  focusCellAndEmit(newRow?.cells[0] ?? null)
}

function onRemoveRow(): void {
  if (!activeCell.value) return
  const table = activeCell.value.closest('table') as HTMLTableElement | null
  const row = activeCell.value.closest('tr')
  if (!table || !row) return

  // Find the next row to focus after removal
  const nextRow =
    (row.nextElementSibling as HTMLTableRowElement) ??
    (row.previousElementSibling as HTMLTableRowElement)

  if (removeRow(activeCell.value)) {
    const nextCell = nextRow?.cells?.[0] ?? null
    focusCellAndEmit(nextCell)
  }
}

function onAddColumnLeft(): void {
  if (!activeCell.value) return
  addColumnLeft(activeCell.value)
  focusCellAndEmit(activeCell.value)
}

function onAddColumnRight(): void {
  if (!activeCell.value) return
  addColumnRight(activeCell.value)
  focusCellAndEmit(activeCell.value)
}

function onRemoveColumn(): void {
  if (!activeCell.value) return
  const table = activeCell.value.closest('table') as HTMLTableElement | null
  const row = activeCell.value.closest('tr')
  if (!table || !row) return

  // Find the cell index and find adjacent cell to focus
  const cellIdx = Array.from(row.cells).indexOf(activeCell.value)
  if (removeColumn(activeCell.value)) {
    const newIdx = Math.min(cellIdx, row.cells.length - 1)
    focusCellAndEmit(row.cells[newIdx] ?? null)
  }
}

function onDeleteTable(): void {
  if (!activeCell.value) return
  const table = activeCell.value.closest('table')
  if (!table) return

  // Replace table with an empty paragraph
  const p = document.createElement('p')
  p.innerHTML = '<br>'
  table.parentNode?.replaceChild(p, table)

  activeCell.value = null
  visible.value = false

  // Focus the new paragraph
  const sel = window.getSelection()
  if (sel) {
    const range = document.createRange()
    range.selectNodeContents(p)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  emit('change')
}
</script>
