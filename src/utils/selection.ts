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
  const listSelection = getSiblingListItemSelection(range)

  if (listSelection) {
    wrapSiblingListItemSelection(sel, range, listSelection, tagName)
    return
  }

  // Check if selection is already within this tag → unwrap or exit
  const ancestor = findAncestor(range.commonAncestorContainer, tagName)
  if (ancestor) {
    // If the selection is collapsed (no text selected) and the tag is an
    // inline formatting tag, don't unwrap — just move the cursor outside
    // the styled element so new text won't carry the style.
    const inlineTags = new Set(['STRONG', 'EM', 'DEL', 'S', 'CODE'])
    if (range.collapsed && inlineTags.has(ancestor.tagName)) {
      // Clean up: if the element is empty or only contains a ZWS, remove it
      const text = ancestor.textContent || ''
      if (!text || text === '\u200B') {
        unwrapNode(ancestor)
        return
      }
      // Move cursor to just after the styled element
      const newRange = document.createRange()
      newRange.setStartAfter(ancestor)
      newRange.collapse(true)
      // Insert a zero-width space after the element to ensure the cursor
      // lands outside it (browsers tend to pull the cursor back inside)
      const zws = document.createTextNode('\u200B')
      newRange.insertNode(zws)
      newRange.setStartAfter(zws)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      return
    }
    unwrapNode(ancestor)
    return
  }

  // Wrap
  if (range.collapsed) {
    const wrapper = document.createElement(tagName)
    // No text selected — insert placeholder content so the element is
    // visible and interactable.  For <code> use a non-breaking space;
    // for other inline tags use a zero-width space.
    const placeholder = tagName.toLowerCase() === 'code' ? '\u00A0' : '\u200B'
    wrapper.textContent = placeholder
    range.insertNode(wrapper)
    // Select the placeholder so the user can immediately type to replace
    sel.removeAllRanges()
    const newRange = document.createRange()
    newRange.selectNodeContents(wrapper)
    sel.addRange(newRange)
    return
  }

  const wrapper = wrapRange(range, tagName)
  if (!wrapper) return

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

  // If the block is the editor root itself, the cursor is on bare text
  // with no wrapping <p>. Wrap that text in a <p> first, then proceed.
  if (block === editorEl) {
    const range = sel.getRangeAt(0)
    // Find the top-level node the cursor is inside
    let targetNode: Node | null = sel.anchorNode
    while (targetNode && targetNode.parentNode !== editorEl) {
      targetNode = targetNode.parentNode
    }
    if (!targetNode) {
      // Editor is completely empty — create a paragraph with placeholder
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      editorEl.appendChild(p)
      targetNode = p
    }
    // If it's a bare text node (or inline), wrap it in a <p>
    if (targetNode.nodeType === Node.TEXT_NODE ||
      (targetNode.nodeType === Node.ELEMENT_NODE &&
        !new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'UL', 'OL']).has((targetNode as HTMLElement).tagName))) {
      const p = document.createElement('p')
      editorEl.insertBefore(p, targetNode)
      p.appendChild(targetNode)
      targetNode = p
    }
    // Now wrap the <p> in the target block element
    const wrapper = document.createElement(tagName)
    targetNode.parentNode?.insertBefore(wrapper, targetNode)
    wrapper.appendChild(targetNode)
    const newRange = document.createRange()
    newRange.selectNodeContents(wrapper)
    newRange.collapse(false)
    sel.removeAllRanges()
    sel.addRange(newRange)
    return
  }

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

function wrapRange(range: Range, tagName: string): HTMLElement | null {
  const wrapper = document.createElement(tagName)

  try {
    range.surroundContents(wrapper)
  } catch {
    // surroundContents fails when selection spans multiple elements.
    // Fallback: extract, wrap, re-insert.
    const fragment = range.extractContents()
    if (!fragment.childNodes.length) return null
    wrapper.appendChild(fragment)
    range.insertNode(wrapper)
  }

  return wrapper
}

function getSiblingListItemSelection(range: Range): HTMLLIElement[] | null {
  if (range.collapsed) return null

  const startItem = findClosestElement(range.startContainer, 'LI')
  const endItem = findClosestElement(range.endContainer, 'LI')
  if (!(startItem instanceof HTMLLIElement) || !(endItem instanceof HTMLLIElement) || startItem === endItem) return null

  const parentList = startItem.parentElement
  if (!parentList || parentList !== endItem.parentElement) return null
  if (parentList.tagName !== 'UL' && parentList.tagName !== 'OL') return null

  const items = Array.from(parentList.children).filter(
    (child): child is HTMLLIElement => child instanceof HTMLLIElement,
  )
  const startIndex = items.indexOf(startItem)
  const endIndex = items.indexOf(endItem)
  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) return null

  return items.slice(startIndex, endIndex + 1)
}

function wrapSiblingListItemSelection(
  selection: Selection,
  sourceRange: Range,
  items: HTMLLIElement[],
  tagName: string,
): void {
  const itemRanges = items
    .map((item, index) => createListItemContentRange(item, sourceRange, index === 0, index === items.length - 1))
    .filter((range): range is Range => range !== null)

  if (itemRanges.length === 0) return

  const shouldUnwrap = itemRanges.every((range) => findAncestor(range.commonAncestorContainer, tagName) !== null)

  if (shouldUnwrap) {
    const ancestors = new Set<HTMLElement>()
    itemRanges.forEach((range) => {
      const ancestor = findAncestor(range.commonAncestorContainer, tagName)
      if (ancestor) ancestors.add(ancestor)
    })
    ancestors.forEach((ancestor) => unwrapNode(ancestor))
  } else {
    itemRanges.forEach((range) => {
      if (findAncestor(range.commonAncestorContainer, tagName)) return
      wrapRange(range, tagName)
    })
  }

  restoreSiblingListItemSelection(selection, items[0], items[items.length - 1])
}

function createListItemContentRange(
  item: HTMLLIElement,
  sourceRange: Range,
  isStartItem: boolean,
  isEndItem: boolean,
): Range | null {
  const contentNodes = getListItemContentNodes(item)
  if (contentNodes.length === 0) return null

  const range = document.createRange()
  const firstNode = contentNodes[0]
  const lastNode = contentNodes[contentNodes.length - 1]

  if (isStartItem) {
    range.setStart(sourceRange.startContainer, sourceRange.startOffset)
  } else {
    range.setStartBefore(firstNode)
  }

  if (isEndItem) {
    range.setEnd(sourceRange.endContainer, sourceRange.endOffset)
  } else {
    range.setEndAfter(lastNode)
  }

  return range.collapsed ? null : range
}

function getListItemContentNodes(item: HTMLLIElement): Node[] {
  return Array.from(item.childNodes).filter((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return true
    const tagName = (node as HTMLElement).tagName
    return tagName !== 'UL' && tagName !== 'OL'
  })
}

function restoreSiblingListItemSelection(
  selection: Selection,
  startItem: HTMLLIElement,
  endItem: HTMLLIElement,
): void {
  const startNode = getListItemBoundaryNode(startItem, 'start')
  const endNode = getListItemBoundaryNode(endItem, 'end')
  if (!startNode || !endNode) return

  const range = document.createRange()

  if (startNode.nodeType === Node.TEXT_NODE) {
    range.setStart(startNode, 0)
  } else {
    range.setStartBefore(startNode)
  }

  if (endNode.nodeType === Node.TEXT_NODE) {
    range.setEnd(endNode, endNode.textContent?.length ?? 0)
  } else {
    range.setEndAfter(endNode)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

function getListItemBoundaryNode(item: HTMLLIElement, boundary: 'start' | 'end'): Node | null {
  const contentNodes = getListItemContentNodes(item)
  if (contentNodes.length === 0) return null
  return boundary === 'start' ? contentNodes[0] : contentNodes[contentNodes.length - 1]
}

function findClosestElement(node: Node | null, tagName: string): HTMLElement | null {
  let current = node
  const targetTag = tagName.toUpperCase()

  while (current && current !== document.body) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).tagName === targetTag
    ) {
      return current as HTMLElement
    }
    current = current.parentNode
  }

  return null
}

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
