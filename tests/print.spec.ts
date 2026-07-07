import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPrintDocument, printMarkdown } from '@/utils/print'

describe('buildPrintDocument', () => {
  it('renders markdown into the viewer content wrapper', () => {
    const html = buildPrintDocument('# Hello\n\nThis is **bold**.')

    expect(html).toContain('<div class="cliveedit ce-print">')
    expect(html).toContain('class="ce-viewer__content"')
    expect(html).toContain('<h1')
    expect(html).toContain('Hello')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('uses the provided title and escapes it', () => {
    const html = buildPrintDocument('content', { title: 'A & B <doc>' })
    expect(html).toContain('<title>A &amp; B &lt;doc&gt;</title>')
  })

  it('falls back to a default title', () => {
    const html = buildPrintDocument('content')
    expect(html).toContain('<title>Print</title>')
  })

  it('includes print rules that keep atomic blocks together across pages', () => {
    const html = buildPrintDocument('content')

    // Code blocks, tables, etc. should not be split across pages.
    expect(html).toContain('break-inside: avoid')
    expect(html).toContain('page-break-inside: avoid')
    // Headings stay with the content that follows.
    expect(html).toContain('break-after: avoid')
    // Orphan/widow control for paragraphs.
    expect(html).toMatch(/orphans:\s*3/)
    expect(html).toMatch(/widows:\s*3/)
    // Repeating table headers on each page.
    expect(html).toContain('display: table-header-group')
  })

  it('inlines the host document stylesheets so the print view is styled', () => {
    const style = document.createElement('style')
    style.textContent = '.ce-print { color: rebeccapurple; }'
    document.head.appendChild(style)

    try {
      const html = buildPrintDocument('content')
      expect(html).toContain('rebeccapurple')
    } finally {
      style.remove()
    }
  })
})

describe('printMarkdown', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((el) => el.remove())
  })

  it('appends a hidden, off-screen iframe to the document body', () => {
    const iframe = printMarkdown('# Print me')

    expect(iframe).not.toBeNull()
    expect(iframe?.parentNode).toBe(document.body)
    expect(iframe?.getAttribute('aria-hidden')).toBe('true')
    expect(iframe?.style.visibility).toBe('hidden')
  })

  it('does not modify the host document body content', () => {
    const marker = document.createElement('p')
    marker.textContent = 'host content'
    document.body.appendChild(marker)

    try {
      printMarkdown('# Isolated')
      expect(marker.textContent).toBe('host content')
      // The rendered markdown must not leak into the host document.
      expect(marker.parentElement?.querySelector('h1')).toBeNull()
    } finally {
      marker.remove()
    }
  })

  it('writes the rendered content into the iframe document', () => {
    const iframe = printMarkdown('# Heading\n\nSome text')
    const doc = iframe?.contentDocument

    expect(doc?.querySelector('.ce-viewer__content h1')?.textContent).toBe('Heading')
    expect(doc?.body.textContent).toContain('Some text')
  })

  it('returns null when there is no document (SSR guard)', () => {
    const original = globalThis.document
    // Simulate a non-DOM environment.
    vi.stubGlobal('document', undefined)
    try {
      expect(printMarkdown('# nope')).toBeNull()
    } finally {
      vi.stubGlobal('document', original)
    }
  })
})
