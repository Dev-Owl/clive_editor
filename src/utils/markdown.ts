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
  return md.render(markdown)
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
  return td.turndown(cell.innerHTML).replace(/\n/g, ' ').trim()
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

    const row = cells.map((c) => ` ${cellContent(c)} `).join('|')
    return `|${row}|\n`
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
    )
    const separator = cells.map(() => ' --- ').join('|')
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
    // Ensure blank lines around the table for valid markdown
    return `\n\n${content}\n`
  },
})

/**
 * Convert an HTML string back to markdown.
 */
export function serializeHtml(html: string): string {
  return td.turndown(html)
}
