/* ================================================================== */
/*  markdown.ts — thin wrappers around markdown-it & turndown          */
/* ================================================================== */

import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'

/* ---------- Types ---------- */

export interface ParseMarkdownOptions {
  /** Optional highlight function: receives (code, lang) and returns highlighted HTML or '' */
  highlight?: (code: string, lang: string) => string
}

/* ---------- markdown-it (MD → HTML) ---------- */

/**
 * Create a configured MarkdownIt instance.
 * When a `highlight` function is provided, code blocks are syntax-highlighted
 * and a language label element is injected into the output.
 */
function createMarkdownIt(highlight?: (code: string, lang: string) => string): MarkdownIt {
  const md = new MarkdownIt({
    html: false,       // disable raw HTML tags in source (security)
    linkify: true,     // auto-convert URL-like text to links
    typographer: true, // smart-quotes, dashes
    breaks: true,      // convert \n in paragraphs into <br>
  })

  /* ---------- heading anchor slugs ---------- */

  const defaultHeadingOpen =
    md.renderer.rules.heading_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const contentToken = tokens[idx + 1]
    if (contentToken?.type === 'inline' && contentToken.content) {
      const slug = slugify(contentToken.content)
      token.attrSet('id', slug)
    }
    return defaultHeadingOpen(tokens, idx, options, env, self)
  }

  /* ---------- custom fence renderer (code blocks) ---------- */

  md.renderer.rules.fence = (tokens, idx, options, _env, _self) => {
    const token = tokens[idx]
    const rawLang = (token.info || '').trim()
    const lang = rawLang || ''
    const code = token.content

    // Language label HTML (positioned via CSS)
    const displayLang = lang || 'plain text'
    const langLabel = `<div class="ce-code-lang" contenteditable="false" data-lang="${lang}">${escapeHtmlStr(displayLang)}</div>`

    // Try syntax highlighting
    if (highlight && lang) {
      const highlighted = highlight(code, lang)
      if (highlighted) {
        // Shiki returns a complete <pre><code>…</code></pre> block.
        // We need to inject our language label inside the <pre> and add
        // the language class to the <code> element.
        const withClass = highlighted.replace(
          /(<pre[^>]*>)\s*(<code)/,
          `$1${langLabel}<code class="language-${escapeAttrStr(lang)}"`,
        )
        return withClass
      }
    }

    // Fallback: plain code block with language label
    const langClass = lang ? ` class="language-${escapeAttrStr(lang)}"` : ''
    return `<pre>${langLabel}<code${langClass}>${escapeHtmlStr(code)}</code></pre>\n`
  }

  return md
}

/* ---------- MD instances ---------- */

// Default instance (no highlighting)
let mdPlain: MarkdownIt | null = null
// Highlighted instance (cached per highlight function reference)
let mdHighlighted: MarkdownIt | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedHighlightFn: any = null

function getMdInstance(highlight?: (code: string, lang: string) => string): MarkdownIt {
  if (!highlight) {
    if (!mdPlain) mdPlain = createMarkdownIt()
    return mdPlain
  }
  // Re-use if the highlight function hasn't changed
  if (mdHighlighted && cachedHighlightFn === highlight) {
    return mdHighlighted
  }
  mdHighlighted = createMarkdownIt(highlight)
  cachedHighlightFn = highlight
  return mdHighlighted
}

/* ---------- helpers ---------- */

/**
 * Generate a URL-friendly slug from heading text.
 * Matches GitHub-style anchor generation.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // strip non-word chars (except spaces & dashes)
    .replace(/\s+/g, '-')       // spaces → hyphens
    .replace(/-+/g, '-')        // collapse consecutive hyphens
}

function escapeHtmlStr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttrStr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * Parse a markdown string into an HTML string.
 *
 * @param markdown  Raw markdown source
 * @param options   Optional: pass a `highlight` function for syntax highlighting
 */
export function parseMarkdown(markdown: string, options?: ParseMarkdownOptions): string {
  const md = getMdInstance(options?.highlight)
  const html = md.render(sanitizeMarkdownTables(markdown))
  return restoreRichTableCells(html)
}

/**
 * Sanitize malformed markdown tables:
 * - Normalize column counts across all rows
 * - Add missing separator row after the header
 */
function sanitizeMarkdownTables(markdown: string): string {
  const lines = markdown.split('\n')
  const result: string[] = []
  let tableBuffer: string[] = []

  const isTableRow = (line: string) => {
    const trimmed = line.trim()
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1
  }

  const isSeparator = (line: string) =>
    /^\|(\s*:?-+:?\s*\|)+\s*$/.test(line.trim())

  const flushTable = () => {
    if (tableBuffer.length === 0) return

    // A single pipe-row is not a table
    if (tableBuffer.length < 2) {
      result.push(...tableBuffer)
      tableBuffer = []
      return
    }

    // Count max columns across non-separator rows
    const dataLines = tableBuffer.filter((l) => !isSeparator(l))
    const colCounts = dataLines.map((l) => {
      const parts = l.trim().split('|')
      return parts.slice(1, parts.length - 1).length
    })
    const maxCols = Math.max(...colCounts, 1)

    const hasSep = tableBuffer.some(isSeparator)

    // Pad all rows and regenerate separators with correct column count
    const padded = tableBuffer.map((l) => {
      if (isSeparator(l)) {
        return '|' + ' --- |'.repeat(maxCols)
      }
      const parts = l.trim().split('|')
      const cells = parts.slice(1, parts.length - 1)
      while (cells.length < maxCols) cells.push('  ')
      return '|' + cells.join('|') + '|'
    })

    // Insert separator after first row if missing
    if (!hasSep) {
      padded.splice(1, 0, '|' + ' --- |'.repeat(maxCols))
    }

    result.push(...padded)
    tableBuffer = []
  }

  for (const line of lines) {
    if (isTableRow(line)) {
      tableBuffer.push(line)
    } else {
      flushTable()
      result.push(line)
    }
  }
  flushTable()

  return result.join('\n')
}

/* ---------- turndown (HTML → MD) ---------- */

const td = new TurndownService({
  headingStyle: 'atx',          // # style headings
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
})

/* ---------- URL-safe escaping ---------- */

/*
 * Override Turndown's escape so that markdown special characters inside
 * URL-like patterns (https://… / http://…) are NOT escaped.
 * Without this, underscores in URLs get turned into `\_` which breaks
 * auto-linkification on re-parse.
 */
const originalEscape = td.escape.bind(td)
td.escape = function (str: string): string {
  const urlPattern = /(https?:\/\/[^\s<>[\]]*)/g
  const parts = str.split(urlPattern)
  return parts
    .map((part, i) => (i % 2 === 1 ? part : originalEscape(part)))
    .join('')
}

/*
 * When a link's visible text is identical to its href (auto-linked URL),
 * emit the raw URL instead of `[url\_escaped](url)`.  This keeps the
 * markdown clean and avoids underscore-escaping in the link text.
 */
td.addRule('autoLink', {
  filter(node) {
    if (node.nodeName !== 'A') return false
    const href = (node as HTMLElement).getAttribute('href')
    const text = node.textContent?.trim()
    return !!href && href === text
  },
  replacement(_content, node) {
    return (node as HTMLElement).getAttribute('href') || ''
  },
})

// Strikethrough rule
td.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement(content) {
    return `~~${content}~~`
  },
})

/* ---------- Fenced code block rule (language-aware) ---------- */

td.addRule('fencedCodeBlock', {
  filter(node) {
    if (node.nodeName !== 'PRE') return false
    const el = node as HTMLElement
    // Match if the <pre> contains a <code> element, OR if it has a
    // language label div (the browser may remove <code> when content
    // is fully deleted but the label div keeps the <pre> alive).
    return !!el.querySelector('code') || !!el.querySelector('.ce-code-lang')
  },
  replacement(_content, node) {
    const el = node as HTMLElement
    const codeEl = el.querySelector('code')

    // Extract language: prefer <code class="language-…">, fall back to label div
    let lang = ''
    if (codeEl) {
      const classMatch = (codeEl.className || '').match(/language-(\S+)/)
      lang = classMatch ? classMatch[1] : ''
    } else {
      const labelEl = el.querySelector('.ce-code-lang')
      lang = (labelEl as HTMLElement)?.dataset?.lang ?? ''
    }

    // Get the raw text content of the code (strip any Shiki highlight spans)
    const code = codeEl ? (codeEl.textContent || '') : ''

    // Remove trailing newline that markdown-it / Shiki often adds
    const trimmed = code.replace(/\n$/, '')

    return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`
  },
})

// Ignore the language label divs — they're handled by the fencedCodeBlock rule
td.addRule('codeLangLabel', {
  filter(node) {
    return (
      node.nodeName === 'DIV' &&
      (node as HTMLElement).classList?.contains('ce-code-lang') === true
    )
  },
  replacement() {
    return ''
  },
})

/* ---------- GFM table rules ---------- */

/**
 * Helper: count the number of columns by looking at the first <tr>
 * inside the table.  Returns an array of cell counts per row for alignment.
 */
function cellContent(cell: HTMLElement): string {
  return serializeTableCellContent(cell)
}

const CELL_BREAK_TOKEN = 'CLIVEEDIT_TABLE_BR_TOKEN'
const ELEMENT_NODE = 1
const TEXT_NODE = 3

function serializeTableCellContent(cell: HTMLElement): string {
  return serializeTableCellNodes(Array.from(cell.childNodes))
    .replace(new RegExp(`\\s*${CELL_BREAK_TOKEN}\\s*`, 'g'), ' <br> ')
    .replace(/\s+/g, ' ')
    .trim()
}

function serializeTableCellList(list: HTMLElement): string {
  return Array.from(list.querySelectorAll(':scope > li'))
    .map((li, index) => {
      const content = serializeTableCellNodes(Array.from(li.childNodes))
        .replace(new RegExp(`\\s*${CELL_BREAK_TOKEN}\\s*`, 'g'), ' <br> ')
        .replace(/\s+/g, ' ')
        .trim()
      const prefix = list.tagName === 'OL' ? `${index + 1}. ` : '- '
      return `${prefix}${content || ''}`.trimEnd()
    })
    .join(` ${CELL_BREAK_TOKEN} `)
}

function serializeTableCellNodes(nodes: Node[]): string {
  const parts: string[] = []

  nodes.forEach((node, index) => {
    if (node.nodeType === TEXT_NODE) {
      parts.push(td.escape(node.textContent ?? ''))
      return
    }

    if (node.nodeType !== ELEMENT_NODE) return

    const el = node as HTMLElement
    if (el.tagName === 'BR') {
      parts.push(CELL_BREAK_TOKEN)
      return
    }

    if (el.tagName === 'UL' || el.tagName === 'OL') {
      parts.push(serializeTableCellList(el))
      if (shouldInsertTableCellBreak(nodes, index)) parts.push(CELL_BREAK_TOKEN)
      return
    }

    if (el.tagName === 'DIV' || el.tagName === 'P') {
      const content = serializeTableCellNodes(Array.from(el.childNodes)).trim()
      if (content) parts.push(content)
      if (shouldInsertTableCellBreak(nodes, index)) parts.push(CELL_BREAK_TOKEN)
      return
    }

    parts.push(td.turndown(el.outerHTML).replace(/\n/g, ' ').trim())
  })

  return parts.join('')
}

function shouldInsertTableCellBreak(nodes: Node[], index: number): boolean {
  for (const node of nodes.slice(index + 1)) {
    if (node.nodeType === TEXT_NODE) {
      if (node.textContent?.trim()) return true
      continue
    }
    if (node.nodeType !== ELEMENT_NODE) continue
    return (node as HTMLElement).tagName !== 'BR'
  }
  return false
}

function restoreRichTableCells(html: string): string {
  if (typeof document === 'undefined') return html

  const container = document.createElement('div')
  container.innerHTML = html

  for (const cell of Array.from(container.querySelectorAll('td, th'))) {
    restoreRichTableCell(cell as HTMLElement)
  }

  return container.innerHTML
}

function restoreRichTableCell(cell: HTMLElement): void {
  const decodedHtml = cell.innerHTML.replace(/&lt;br\s*\/?&gt;/gi, '<br>')
  if (decodedHtml !== cell.innerHTML) {
    cell.innerHTML = decodedHtml
  }

  if (cell.querySelector('ul, ol')) return

  const segments = cell.innerHTML
    .split(/<br\s*\/?>/i)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  if (segments.length === 0) return

  const classified = segments.map(classifyTableCellSegment)
  if (!classified.some((segment) => segment.type === 'bullet' || segment.type === 'ordered')) return

  const fragment = document.createDocumentFragment()
  let activeList: HTMLOListElement | HTMLUListElement | null = null
  let activeListType: 'bullet' | 'ordered' | null = null

  const flushList = () => {
    if (!activeList) return
    fragment.appendChild(activeList)
    activeList = null
    activeListType = null
  }

  classified.forEach((segment, index) => {
    if (segment.type === 'bullet' || segment.type === 'ordered') {
      if (!activeList || activeListType !== segment.type) {
        flushList()
        activeList = document.createElement(segment.type === 'ordered' ? 'ol' : 'ul')
        activeListType = segment.type
      }

      const li = document.createElement('li')
      li.innerHTML = segment.content || '<br>'
      activeList.appendChild(li)
      return
    }

    flushList()
    const wrapper = document.createElement('span')
    wrapper.innerHTML = segment.content
    while (wrapper.firstChild) {
      fragment.appendChild(wrapper.firstChild)
    }
    if (index < classified.length - 1) {
      fragment.appendChild(document.createElement('br'))
    }
  })

  flushList()

  if (fragment.childNodes.length > 0) {
    cell.innerHTML = ''
    cell.appendChild(fragment)
  }
}

function stripHtml(html: string): string {
  const temp = document.createElement('div')
  temp.innerHTML = html
  return temp.textContent?.trim() ?? ''
}

function classifyTableCellSegment(
  segment: string,
): { type: 'bullet' | 'ordered' | 'plain', content: string } {
  const text = stripHtml(segment)
  if (/^[-*]\s+/.test(text)) {
    return {
      type: 'bullet',
      content: segment.replace(/^\s*[-*]\s+/, ''),
    }
  }
  if (/^\d+\.\s+/.test(text)) {
    return {
      type: 'ordered',
      content: segment.replace(/^\s*\d+\.\s+/, ''),
    }
  }
  return {
    type: 'plain',
    content: segment,
  }
}

td.addRule('tableCell', {
  filter: ['th', 'td'],
  replacement(content, node) {
    return ''   // handled by tableRow
  },
})

td.addRule('tableRow', {
  filter: 'tr',
  replacement(_content, node) {
    const el = node as HTMLElement
    const cells = Array.from(el.children).filter(
      (c) => c.tagName === 'TH' || c.tagName === 'TD',
    ) as HTMLElement[]

    // Expand cells with colspan into multiple columns
    const expandedCells: string[] = []
    for (const c of cells) {
      const colspan = parseInt(c.getAttribute('colspan') || '1', 10) || 1
      expandedCells.push(` ${cellContent(c)} `)
      for (let i = 1; i < colspan; i++) {
        expandedCells.push('  ')
      }
    }

    return `|${expandedCells.join('|')}|\n`
  },
})

td.addRule('tableHead', {
  filter: 'thead',
  replacement(content, node) {
    const el = node as HTMLElement
    const firstRow = el.querySelector('tr')
    if (!firstRow) return content

    const cells = Array.from(firstRow.children).filter(
      (c) => c.tagName === 'TH' || c.tagName === 'TD',
    ) as HTMLElement[]
    // Account for colspan when counting separator columns
    let totalCols = 0
    for (const c of cells) {
      totalCols += parseInt(c.getAttribute('colspan') || '1', 10) || 1
    }
    const separator = Array.from({ length: totalCols }, () => ' --- ').join('|')
    return `${content}|${separator}|\n`
  },
})

td.addRule('tableBody', {
  filter: 'tbody',
  replacement(content) {
    return content
  },
})

td.addRule('table', {
  filter: 'table',
  replacement(content) {
    const lines = content.split('\n').filter((l) => l.trim().length > 0)
    if (lines.length === 0) return ''

    const isSep = (l: string) => /^\|(\s*:?-+:?\s*\|)+\s*$/.test(l.trim())
    const hasSeparator = lines.some(isSep)

    // Count max columns across non-separator rows
    const dataLines = lines.filter((l) => !isSep(l))
    const colCounts = dataLines.map((l) => {
      const parts = l.trim().split('|')
      return parts.slice(1, parts.length - 1).length
    })
    const maxCols = Math.max(...colCounts, 1)

    // Pad rows to maxCols and regenerate separators
    const padded = lines.map((l) => {
      if (isSep(l)) {
        return '|' + ' --- |'.repeat(maxCols)
      }
      const parts = l.trim().split('|')
      const cells = parts.slice(1, parts.length - 1)
      while (cells.length < maxCols) cells.push('  ')
      return '|' + cells.join('|') + '|'
    })

    // Add separator after first row if missing
    if (!hasSeparator && padded.length >= 1) {
      padded.splice(1, 0, '|' + ' --- |'.repeat(maxCols))
    }

    return '\n\n' + padded.join('\n') + '\n\n'
  },
})

/**
 * Convert an HTML string back to markdown.
 */
export function serializeHtml(html: string): string {
  return td.turndown(html)
}
