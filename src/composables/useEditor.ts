/* ================================================================== */
/*  useEditor — contenteditable command layer                          */
/*                                                                     */
/*  Provides imperative formatting commands that operate on the        */
/*  current Selection / Range inside the contenteditable element.      */
/* ================================================================== */

import { ref, type Ref } from 'vue'
import {
  wrapSelection,
  wrapBlock,
  insertHtmlAtCursor,
  isInsideTag,
  findClosestCell,
  isSelectionCrossCell,
} from '@/utils/selection'

export function useEditor(editorRef: Ref<HTMLElement | null>) {
  /* ---- active-state tracking ---- */

  const activeTags = ref<Set<string>>(new Set())

  function refreshActiveState(): void {
    const tags = ['STRONG', 'EM', 'DEL', 'S', 'CODE', 'A',
      'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TABLE']
    const newSet = new Set<string>()
    for (const tag of tags) {
      if (isInsideTag(tag)) newSet.add(tag)
    }
    activeTags.value = newSet
  }

  function isActive(tag: string): boolean {
    return activeTags.value.has(tag.toUpperCase())
  }

  /* ---- inline formatting ---- */

  function bold(): void {
    if (isSelectionCrossCell()) return
    wrapSelection('strong')
    refreshActiveState()
  }

  function italic(): void {
    if (isSelectionCrossCell()) return
    wrapSelection('em')
    refreshActiveState()
  }

  function strikethrough(): void {
    if (isSelectionCrossCell()) return
    wrapSelection('del')
    refreshActiveState()
  }

  function codeInline(): void {
    if (isSelectionCrossCell()) return
    wrapSelection('code')
    refreshActiveState()
  }

  /* ---- headings ---- */

  function heading(level: 1 | 2 | 3): void {
    const el = editorRef.value
    if (!el) return

    // Guard: don't apply headings inside table cells
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    if (findClosestCell(sel.anchorNode)) return

    const targetTag = `H${level}`

    // Find the closest block element
    let block = sel.anchorNode as Node | null
    while (block && block !== el) {
      if (
        block.nodeType === Node.ELEMENT_NODE &&
        /^(P|DIV|H[1-6])$/.test((block as HTMLElement).tagName)
      ) {
        break
      }
      block = block.parentNode
    }

    if (!block || block === el) {
      // No block found — insert a new heading with default text
      const h = document.createElement(targetTag)
      h.textContent = 'Heading'
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(h)
      // Ensure heading is not nested inside another inline/block accidentally
      // by moving it to editor root if needed
      if (h.parentElement && h.parentElement !== el) {
        el.insertBefore(h, h.parentElement.nextSibling)
      }
      // Select the default text so the user can type to replace
      const newRange = document.createRange()
      newRange.selectNodeContents(h)
      sel.removeAllRanges()
      sel.addRange(newRange)
    } else {
      const currentTag = (block as HTMLElement).tagName

      if (currentTag === targetTag) {
        // Toggle off → convert to <p>
        const p = document.createElement('p')
        p.innerHTML = (block as HTMLElement).innerHTML
        block.parentNode?.replaceChild(p, block)
        // Place cursor in the paragraph
        const range = document.createRange()
        range.selectNodeContents(p)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        // Convert to the target heading
        const blockContent = (block as HTMLElement).textContent || ''
        const blockInner = (block as HTMLElement).innerHTML
        const h = document.createElement(targetTag)
        // If block is empty, insert default "Heading" text
        if (!blockContent.trim() || blockInner === '<br>') {
          h.textContent = 'Heading'
        } else {
          h.innerHTML = blockInner
        }
        block.parentNode?.replaceChild(h, block)
        // Select default text so user can replace, or place cursor at end
        const range = document.createRange()
        range.selectNodeContents(h)
        if (!blockContent.trim() || blockInner === '<br>') {
          // Select so user can immediately type replacement
          sel.removeAllRanges()
          sel.addRange(range)
        } else {
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
    }
    refreshActiveState()
  }

  /* ---- lists ---- */

  function bulletList(): void {
    insertList('ul')
  }

  function orderedList(): void {
    insertList('ol')
  }

  function insertList(listTag: 'ul' | 'ol'): void {
    const el = editorRef.value
    if (!el) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    // Guard: don't insert lists inside table cells
    if (findClosestCell(sel.anchorNode)) return

    // Determine the opposite list type
    const otherTag: 'ul' | 'ol' = listTag === 'ul' ? 'ol' : 'ul'

    // Check if already inside the *same* list type → unwrap
    if (isInsideTag(listTag)) {
      // Unwrap — convert list items back to paragraphs
      let listNode = sel.anchorNode as Node | null
      while (listNode && listNode !== el) {
        if (
          listNode.nodeType === Node.ELEMENT_NODE &&
          (listNode as HTMLElement).tagName === listTag.toUpperCase()
        ) {
          break
        }
        listNode = listNode.parentNode
      }
      if (listNode && listNode !== el) {
        const frag = document.createDocumentFragment()
        const items = Array.from(
          (listNode as HTMLElement).querySelectorAll(':scope > li'),
        )
        for (const li of items) {
          const p = document.createElement('p')
          p.innerHTML = li.innerHTML
          frag.appendChild(p)
        }
        listNode.parentNode?.replaceChild(frag, listNode)
      }
    } else if (isInsideTag(otherTag)) {
      // Inside the opposite list type → convert to the target type
      // Find the outermost list of the other type
      let listNode = sel.anchorNode as Node | null
      let outermostList: HTMLElement | null = null
      while (listNode && listNode !== el) {
        if (
          listNode.nodeType === Node.ELEMENT_NODE &&
          ((listNode as HTMLElement).tagName === 'UL' ||
            (listNode as HTMLElement).tagName === 'OL')
        ) {
          outermostList = listNode as HTMLElement
        }
        listNode = listNode.parentNode
      }
      if (outermostList) {
        // Save cursor position
        const range = sel.getRangeAt(0)
        const savedStartContainer = range.startContainer
        const savedStartOffset = range.startOffset

        // Recursively convert all list elements (including nested) to the target tag
        convertListType(outermostList, listTag)

        // Restore cursor
        try {
          const newRange = document.createRange()
          newRange.setStart(savedStartContainer, savedStartOffset)
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
        } catch {
          // If cursor restoration fails, place at end of converted list
        }
      }
    } else {
      // Collect block-level nodes that intersect the selection
      const range = sel.getRangeAt(0)
      const blocks = getSelectedBlocks(range, el)

      if (blocks.length > 1) {
        // Multiple blocks selected → each becomes a list item
        const list = document.createElement(listTag)
        for (const block of blocks) {
          const li = document.createElement('li')
          li.innerHTML = (block as HTMLElement).innerHTML ?? block.textContent ?? ''
          list.appendChild(li)
        }
        // Insert the list before the first block, then remove all original blocks
        blocks[0].parentNode?.insertBefore(list, blocks[0])
        for (const block of blocks) {
          block.parentNode?.removeChild(block)
        }
        // Place cursor at end of list
        const newRange = document.createRange()
        newRange.selectNodeContents(list.lastElementChild || list)
        newRange.collapse(false)
        sel.removeAllRanges()
        sel.addRange(newRange)
      } else {
        // Single line or collapsed — create a list with one item
        const text = sel.toString() || 'List item'
        const lines = text.split('\n').filter(l => l.trim() !== '')
        const items = lines.length > 0
          ? lines.map(l => `<li>${escapeHtml(l)}</li>`).join('')
          : '<li>List item</li>'
        const html = `<${listTag}>${items}</${listTag}>`
        range.deleteContents()
        insertHtmlAtCursor(html)
      }
    }
    refreshActiveState()
  }

  /**
   * Collect all block-level nodes that intersect the given range
   * within the editor element.
   */
  function getSelectedBlocks(range: Range, container: HTMLElement): Node[] {
    const blocks: Node[] = []
    const blockTags = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'])

    // Walk direct children of the container (top-level blocks)
    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && blockTags.has((child as HTMLElement).tagName)) {
        // Check if this block intersects the range
        const nodeRange = document.createRange()
        nodeRange.selectNodeContents(child)
        if (
          range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
          range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0
        ) {
          blocks.push(child)
        }
      }
    }
    return blocks
  }

  /**
   * Recursively convert a list element (and all nested sub-lists)
   * from one type to another (ul ↔ ol) in place.
   */
  function convertListType(
    listEl: HTMLElement,
    targetTag: 'ul' | 'ol',
  ): HTMLElement {
    // First, recursively convert any nested lists inside child <li> elements
    for (const li of Array.from(listEl.querySelectorAll(':scope > li'))) {
      for (const nested of Array.from(
        li.querySelectorAll(':scope > ul, :scope > ol'),
      )) {
        convertListType(nested as HTMLElement, targetTag)
      }
    }

    // Now convert this list element itself
    const tag = targetTag.toUpperCase()
    if (listEl.tagName === tag) return listEl // already correct type

    const newList = document.createElement(targetTag)
    // Move all children (li elements, etc.) to the new list
    while (listEl.firstChild) {
      newList.appendChild(listEl.firstChild)
    }
    listEl.parentNode?.replaceChild(newList, listEl)
    return newList
  }

  /* ---- list indent / outdent ---- */

  function indentList(): void {
    const el = editorRef.value
    if (!el) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    // Find the <li> the cursor is in
    const li = findAncestorTag(sel.anchorNode, 'LI', el)
    if (!li) return

    // Must have a previous sibling <li> to nest into
    const prevLi = li.previousElementSibling
    if (!prevLi || prevLi.tagName !== 'LI') return

    // Determine the list type from the parent
    const parentList = li.parentElement
    if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) return
    const listTag = parentList.tagName.toLowerCase() as 'ul' | 'ol'

    // Check if prevLi already has a nested sub-list
    let subList = prevLi.querySelector(':scope > ul, :scope > ol') as HTMLElement | null
    if (!subList) {
      subList = document.createElement(listTag)
      prevLi.appendChild(subList)
    }

    // Move current li into the sub-list
    subList.appendChild(li)

    // Restore cursor
    const newRange = document.createRange()
    newRange.selectNodeContents(li)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    refreshActiveState()
  }

  function outdentList(): void {
    const el = editorRef.value
    if (!el) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    // Find the <li> the cursor is in
    const li = findAncestorTag(sel.anchorNode, 'LI', el)
    if (!li) return

    // The <li> must be inside a nested list (parent list inside another <li>)
    const parentList = li.parentElement
    if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) return

    const grandparentLi = parentList.parentElement
    if (!grandparentLi || grandparentLi.tagName !== 'LI') return

    const grandparentList = grandparentLi.parentElement
    if (!grandparentList || (grandparentList.tagName !== 'UL' && grandparentList.tagName !== 'OL')) return

    // Move any subsequent siblings of li into a new sub-list that stays nested
    const siblingsAfter: HTMLElement[] = []
    let next = li.nextElementSibling
    while (next) {
      siblingsAfter.push(next as HTMLElement)
      next = next.nextElementSibling
    }
    if (siblingsAfter.length > 0) {
      const newSubList = document.createElement(parentList.tagName.toLowerCase())
      for (const sib of siblingsAfter) {
        newSubList.appendChild(sib)
      }
      li.appendChild(newSubList)
    }

    // Insert li after the grandparent <li> in the grandparent list
    grandparentList.insertBefore(li, grandparentLi.nextSibling)

    // If the old parent list is now empty, remove it
    if (parentList.children.length === 0) {
      parentList.parentNode?.removeChild(parentList)
    }

    // Restore cursor
    const newRange = document.createRange()
    newRange.selectNodeContents(li)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    refreshActiveState()
  }

  /**
   * Walk up from `node` to find the closest element matching `tagName`.
   * Stops at the `boundary` element.
   */
  function findAncestorTag(node: Node | null, tagName: string, boundary: HTMLElement): HTMLElement | null {
    const tag = tagName.toUpperCase()
    let current = node
    while (current && current !== boundary) {
      if (current.nodeType === Node.ELEMENT_NODE && (current as HTMLElement).tagName === tag) {
        return current as HTMLElement
      }
      current = current.parentNode
    }
    return null
  }

  /* ---- block-level ---- */

  function blockquote(): void {
    const el = editorRef.value
    if (!el) return
    wrapBlock('blockquote', el)
    refreshActiveState()
  }

  function codeBlock(lang?: string): void {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    // Guard: don't apply code block inside table cells
    if (findClosestCell(sel.anchorNode)) return

    if (isInsideTag('pre')) {
      // Unwrap <pre>
      let preNode = sel.anchorNode as Node | null
      while (preNode && preNode.nodeType !== Node.ELEMENT_NODE || (preNode as HTMLElement)?.tagName !== 'PRE') {
        preNode = preNode?.parentNode ?? null
      }
      if (preNode) {
        const p = document.createElement('p')
        p.textContent = (preNode as HTMLElement).textContent
        preNode.parentNode?.replaceChild(p, preNode)
      }
    } else {
      const text = sel.toString() || 'code'
      const displayLang = lang || 'plain text'
      const langClass = lang ? ` class="language-${escapeAttr(lang)}"` : ''
      const langLabel = `<div class="ce-code-lang" contenteditable="false" data-lang="${escapeAttr(lang || '')}">${escapeHtml(displayLang)}</div>`
      insertHtmlAtCursor(`<pre>${langLabel}<code${langClass}>${escapeHtml(text)}</code></pre><p><br></p>`)
    }
    refreshActiveState()
  }

  /* ---- inline elements ---- */

  function link(url?: string, text?: string): void {
    const sel = window.getSelection()
    const selectedText = sel?.toString() || ''

    const finalUrl = url ?? prompt('Enter URL:', 'https://')
    if (!finalUrl) return

    const finalText = text ?? (selectedText || finalUrl)
    const html = `<a href="${escapeAttr(finalUrl)}">${escapeHtml(finalText)}</a>`

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
    }
    insertHtmlAtCursor(html)
    refreshActiveState()
  }

  function image(src?: string, alt?: string): void {
    const finalSrc = src ?? prompt('Enter image URL:', 'https://')
    if (!finalSrc) return

    const finalAlt = alt ?? 'image'
    const html = `<img src="${escapeAttr(finalSrc)}" alt="${escapeAttr(finalAlt)}" />`
    insertHtmlAtCursor(html)
  }

  function horizontalRule(): void {
    insertHtmlAtCursor('<hr /><p><br></p>')
  }

  function table(rows = 3, cols = 3): void {
    const headerCells = Array.from({ length: cols }, (_, i) => `<th>Header ${i + 1}</th>`).join('')
    const bodyRows = Array.from({ length: rows - 1 }, () => {
      const cells = Array.from({ length: cols }, () => '<td>Cell</td>').join('')
      return `<tr>${cells}</tr>`
    }).join('')
    const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`
    insertHtmlAtCursor(html)
    refreshActiveState()
  }

  /* ---- DOM access ---- */

  function getHtml(): string {
    return editorRef.value?.innerHTML ?? ''
  }

  function setHtml(html: string): void {
    if (editorRef.value) {
      editorRef.value.innerHTML = html
    }
  }

  function focus(): void {
    editorRef.value?.focus()
  }

  /* ---- utils ---- */

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function escapeAttr(str: string): string {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  return {
    // State
    activeTags,
    isActive,
    refreshActiveState,

    // Commands
    bold,
    italic,
    strikethrough,
    heading,
    bulletList,
    orderedList,
    indentList,
    outdentList,
    blockquote,
    codeInline,
    codeBlock,
    link,
    image,
    horizontalRule,
    table,

    // DOM
    getHtml,
    setHtml,
    focus,
  }
}
