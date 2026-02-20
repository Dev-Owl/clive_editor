/* ================================================================== */
/*  markdown.ts — thin wrappers around markdown-it & turndown          */
/* ================================================================== */

import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'

/* ---------- markdown-it (MD → HTML) ---------- */

const md = new MarkdownIt({
  html: false,       // disable raw HTML tags in source (security)
  linkify: true,     // auto-convert URL-like text to links
  typographer: true, // smart-quotes, dashes
  breaks: true,      // convert \n in paragraphs into <br>
})

/* ---------- heading anchor slugs ---------- */

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

// Override the default heading_open renderer to inject `id` attributes
const defaultHeadingOpen =
  md.renderer.rules.heading_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  // Walk forward to find the inline content token
  const contentToken = tokens[idx + 1]
  if (contentToken?.type === 'inline' && contentToken.content) {
    const slug = slugify(contentToken.content)
    token.attrSet('id', slug)
  }
  return defaultHeadingOpen(tokens, idx, options, env, self)
}

/**
 * Parse a markdown string into an HTML string.
 */
export function parseMarkdown(markdown: string): string {
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
