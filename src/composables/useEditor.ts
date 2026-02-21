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
      // No block found — wrap current line
      const tag = `h${level}`
      wrapBlock(tag, el)
    } else {
      const currentTag = (block as HTMLElement).tagName
      const targetTag = `H${level}`

      if (currentTag === targetTag) {
        // Toggle off → convert to <p>
        const p = document.createElement('p')
        p.innerHTML = (block as HTMLElement).innerHTML
        block.parentNode?.replaceChild(p, block)
      } else {
        // Convert to the target heading
        const h = document.createElement(targetTag)
        h.innerHTML = (block as HTMLElement).innerHTML
        block.parentNode?.replaceChild(h, block)
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

    // Check if already inside this list type
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
        const items = Array.from((listNode as HTMLElement).querySelectorAll('li'))
        for (const li of items) {
          const p = document.createElement('p')
          p.innerHTML = li.innerHTML
          frag.appendChild(p)
        }
        listNode.parentNode?.replaceChild(frag, listNode)
      }
    } else {
      // Create a new list with the current selection / block
      const text = sel.toString() || 'List item'
      const html = `<${listTag}><li>${text}</li></${listTag}>`
      const range = sel.getRangeAt(0)
      range.deleteContents()
      insertHtmlAtCursor(html)
    }
    refreshActiveState()
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
