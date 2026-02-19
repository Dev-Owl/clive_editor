/* ================================================================== */
/*  selection.ts — Selection / Range API helpers                        */
/*                                                                     */
/*  All DOM manipulation uses the modern Range API instead of the       */
/*  deprecated document.execCommand.                                   */
/* ================================================================== */

export interface SavedSelection {
  range: Range
}

/* ---------- Save / Restore ---------- */

export function saveSelection(): SavedSelection | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  return { range: sel.getRangeAt(0).cloneRange() }
}

export function restoreSelection(saved: SavedSelection): void {
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(saved.range)
}

/* ---------- Query ---------- */

/**
 * Return the HTML content of the current selection (if any).
 */
export function getSelectedHtml(): string {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return ''
  const frag = sel.getRangeAt(0).cloneContents()
  const div = document.createElement('div')
  div.appendChild(frag)
  return div.innerHTML
}

/**
 * Return the plain text of the current selection.
 */
export function getSelectedText(): string {
  const sel = window.getSelection()
  return sel?.toString() ?? ''
}

/* ---------- Wrapping ---------- */

/**
 * Wrap the current selection in an inline element.
 * E.g. `wrapSelection('strong')` wraps the selection in `<strong>`.
 *
 * If the selection is already entirely within a matching tag, the tag
 * is *removed* (toggle behaviour).
 */
export function wrapSelection(tagName: string): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  // Guard: don't corrupt table structure with cross-cell selections
  if (isSelectionCrossCell()) return

  const range = sel.getRangeAt(0)

  // Check if selection is already within this tag → unwrap
  const ancestor = findAncestor(range.commonAncestorContainer, tagName)
  if (ancestor) {
    unwrapNode(ancestor)
    return
  }

  // Wrap
  const wrapper = document.createElement(tagName)
  try {
    range.surroundContents(wrapper)
  } catch {
    // surroundContents fails when selection spans multiple elements.
    // Fallback: extract, wrap, re-insert.
    const fragment = range.extractContents()
    wrapper.appendChild(fragment)
    range.insertNode(wrapper)
  }

  // Re-select the wrapped content
  sel.removeAllRanges()
  const newRange = document.createRange()
  newRange.selectNodeContents(wrapper)
  sel.addRange(newRange)
}

/* ---------- Block-level manipulation ---------- */

/**
 * Wrap the current block (paragraph) in a block-level element.
 * If already wrapped, toggle off.
 */
export function wrapBlock(tagName: string, editorEl: HTMLElement): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  // Guard: don't apply block commands inside table cells
  if (findClosestCell(sel.anchorNode)) return

  const block = findClosestBlock(sel.anchorNode, editorEl)
  if (!block) return

  const ancestor = findAncestor(block, tagName)
  if (ancestor && ancestor !== editorEl) {
    unwrapNode(ancestor)
    return
  }

  const wrapper = document.createElement(tagName)
  block.parentNode?.insertBefore(wrapper, block)
  wrapper.appendChild(block)

  // Place cursor inside
  const range = document.createRange()
  range.selectNodeContents(wrapper)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

/* ---------- Insert ---------- */

/**
 * Insert an HTML string at the current cursor position.
 */
export function insertHtmlAtCursor(html: string): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  range.deleteContents()

  const temp = document.createElement('div')
  temp.innerHTML = html
  const frag = document.createDocumentFragment()
  let lastNode: Node | null = null
  while (temp.firstChild) {
    lastNode = frag.appendChild(temp.firstChild)
  }
  range.insertNode(frag)

  // Move cursor after inserted content
  if (lastNode) {
    const newRange = document.createRange()
    newRange.setStartAfter(lastNode)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }
}

/**
 * Insert markdown syntax around the current selection in a textarea.
 */
export function insertTextareaSyntax(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
): string {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = textarea.value
  const selected = text.slice(start, end)
  const replacement = `${before}${selected}${after}`
  const newValue = text.slice(0, start) + replacement + text.slice(end)

  // Update selection to be inside the syntax markers
  textarea.value = newValue
  textarea.selectionStart = start + before.length
  textarea.selectionEnd = start + before.length + selected.length
  textarea.focus()

  return newValue
}

/* ---------- Internal helpers ---------- */

/**
 * Walk up the DOM from `node` to find the nearest ancestor matching `tagName`.
 * Stops at the contenteditable boundary.
 */
function findAncestor(node: Node | null, tagName: string): HTMLElement | null {
  const tag = tagName.toUpperCase()
  let current = node
  while (current && current !== document.body) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).tagName === tag
    ) {
      return current as HTMLElement
    }
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).contentEditable === 'true'
    ) {
      break
    }
    current = current.parentNode
  }
  return null
}

/**
 * Find the closest block-level element containing the cursor.
 */
function findClosestBlock(node: Node | null, boundary: HTMLElement): HTMLElement | null {
  const blockTags = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'LI',
  ])
  let current = node
  while (current && current !== boundary) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      blockTags.has((current as HTMLElement).tagName)
    ) {
      return current as HTMLElement
    }
    current = current.parentNode
  }
  // If no block found, the boundary itself acts as the block
  return boundary
}

/**
 * Remove a wrapper element, keeping its children in place.
 */
function unwrapNode(node: HTMLElement): void {
  const parent = node.parentNode
  if (!parent) return
  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node)
  }
  parent.removeChild(node)
}

/**
 * Check if the current selection is inside a given tag.
 */
export function isInsideTag(tagName: string): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  return findAncestor(sel.anchorNode, tagName) !== null
}

/* ---------- Table helpers ---------- */

/**
 * Structural table tags where anchorNode/focusNode can land, but
 * the actual cell is a child addressed by the selection offset.
 */
const TABLE_STRUCTURAL_TAGS = new Set(['TR', 'THEAD', 'TBODY', 'TFOOT', 'TABLE'])

/**
 * Find the closest table cell (TH or TD) containing a node.
 * Also handles the case where `node` is a structural table element
 * (TR, THEAD, etc.) — in which case `offset` is used to resolve
 * the correct child cell.
 */
export function findClosestCell(
  node: Node | null,
  offset?: number,
): HTMLTableCellElement | null {
  if (!node) return null

  // If the node is a structural table element, use the offset to find the child cell
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    TABLE_STRUCTURAL_TAGS.has((node as HTMLElement).tagName)
  ) {
    const el = node as HTMLElement
    if (offset !== undefined && offset < el.childNodes.length) {
      const child = el.childNodes[offset]
      if (child && child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as HTMLElement).tagName
        if (tag === 'TD' || tag === 'TH') return child as HTMLTableCellElement
        // Could be a TR inside THEAD/TBODY — look at first cell in that row
        if (tag === 'TR') {
          const firstCell = (child as HTMLElement).querySelector('th, td')
          if (firstCell) return firstCell as HTMLTableCellElement
        }
      }
    }
    // Fallback: try offset - 1 (cursor can be positioned after a node)
    if (offset !== undefined && offset > 0 && offset - 1 < el.childNodes.length) {
      const prev = el.childNodes[offset - 1]
      if (prev && prev.nodeType === Node.ELEMENT_NODE) {
        const tag = (prev as HTMLElement).tagName
        if (tag === 'TD' || tag === 'TH') return prev as HTMLTableCellElement
        if (tag === 'TR') {
          const lastCell = (prev as HTMLElement).querySelector('th:last-child, td:last-child')
          if (lastCell) return lastCell as HTMLTableCellElement
        }
      }
    }
  }

  // Walk up the tree (standard case: node is inside a cell)
  let current: Node | null = node
  while (current) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      ((current as HTMLElement).tagName === 'TD' || (current as HTMLElement).tagName === 'TH')
    ) {
      return current as HTMLTableCellElement
    }
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).contentEditable === 'true'
    ) {
      break
    }
    current = current.parentNode
  }
  return null
}

/**
 * Check if a node is inside a <table> element.
 */
function isInsideTable(node: Node | null): boolean {
  let current = node
  while (current) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).tagName === 'TABLE'
    ) {
      return true
    }
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).contentEditable === 'true'
    ) {
      break
    }
    current = current.parentNode
  }
  return false
}

/**
 * Simple walk-up to find the nearest TD/TH ancestor.
 * Does NOT use offset-based child resolution — always reliable
 * regardless of selection direction.
 */
function walkUpToCell(node: Node | null): HTMLTableCellElement | null {
  let current = node
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const tag = (current as HTMLElement).tagName
      if (tag === 'TD' || tag === 'TH') return current as HTMLTableCellElement
      if (tag === 'TABLE' || (current as HTMLElement).contentEditable === 'true') return null
    }
    current = current.parentNode
  }
  return null
}

/**
 * Return true if the current selection spans across multiple table cells.
 * Uses Range.commonAncestorContainer as the primary signal — if it walks
 * up to a TD/TH the entire range is within one cell regardless of
 * selection direction (left-to-right or right-to-left).
 */
export function isSelectionCrossCell(): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false

  const range = sel.getRangeAt(0)

  // Fast path: if the common ancestor is inside a single cell, it's NOT cross-cell
  if (walkUpToCell(range.commonAncestorContainer)) return false

  // Common ancestor is above cell level — are we in a table at all?
  if (!isInsideTable(range.commonAncestorContainer)) return false

  // We're in a table but the common ancestor is a row/tbody/table.
  // Walk up from BOTH ends to find the cells they belong to.
  const startCell = walkUpToCell(range.startContainer)
  const endCell = walkUpToCell(range.endContainer)

  // Both inside cells and they're different → truly cross-cell
  if (startCell && endCell && startCell !== endCell) return true

  // Both in the same cell (shouldn't happen since common ancestor would be in a cell)
  if (startCell && endCell && startCell === endCell) return false

  // One end is in a cell, the other is at a structural level (boundary case).
  // This happens with right-to-left selections where the browser represents
  // "start of cell N" as a position at the parent TR/TBODY level.
  // This is NOT a real cross-cell selection — let the single-cell guard handle it.
  if (startCell || endCell) return false

  // Neither end resolved to a cell — both at structural level.
  // Likely a selection spanning the whole table. Treat as cross-cell.
  return true
}

/**
 * When a cross-cell selection is detected, collapse the selection to the
 * first cell and clear text in all selected cells, then place the cursor
 * in the anchor cell.
 */
export function handleCrossCellDelete(): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)
  const table = findAncestor(range.commonAncestorContainer, 'TABLE') as HTMLTableElement | null
  if (!table) return

  // Find all cells that intersect the selection
  const allCells = Array.from(table.querySelectorAll('th, td')) as HTMLTableCellElement[]
  for (const cell of allCells) {
    if (isCellInSelection(cell, range)) {
      // Clear cell content but keep the cell itself
      cell.innerHTML = ''
    }
  }

  // Place cursor in the first selected cell (anchor)
  const anchorCell = findClosestCell(sel.anchorNode, sel.anchorOffset) ?? allCells[0]
  if (anchorCell) {
    const newRange = document.createRange()
    newRange.selectNodeContents(anchorCell)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }
}

/**
 * Check if a cell intersects the given range.
 */
function isCellInSelection(cell: HTMLTableCellElement, range: Range): boolean {
  const cellRange = document.createRange()
  cellRange.selectNodeContents(cell)
  // Check if the ranges overlap
  return (
    range.compareBoundaryPoints(Range.START_TO_END, cellRange) > 0 &&
    range.compareBoundaryPoints(Range.END_TO_START, cellRange) < 0
  )
}

/**
 * Get the next or previous table cell in reading order.
 * Returns null if at the boundary.
 */
export function getAdjacentCell(
  cell: HTMLTableCellElement,
  direction: 'next' | 'prev',
): HTMLTableCellElement | null {
  const table = cell.closest('table')
  if (!table) return null

  const allCells = Array.from(table.querySelectorAll('th, td')) as HTMLTableCellElement[]
  const idx = allCells.indexOf(cell)
  if (idx < 0) return null

  if (direction === 'next') {
    return allCells[idx + 1] ?? null
  } else {
    return allCells[idx - 1] ?? null
  }
}
