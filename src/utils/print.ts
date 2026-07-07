/* ================================================================== */
/*  print.ts — render markdown into an isolated print view             */
/*                                                                     */
/*  The current document / editor is never mutated. We render the      */
/*  markdown to HTML, drop it into an off-screen iframe that inherits   */
/*  the page's stylesheets, and trigger the browser's print dialog on   */
/*  that iframe. The iframe is removed once printing finishes.          */
/* ================================================================== */

import { parseMarkdown, type ParseMarkdownOptions } from './markdown'

export interface PrintOptions extends ParseMarkdownOptions {
  /** Optional document title used in the print header / saved-PDF filename */
  title?: string
}

/**
 * Collect the CSS of the current page so the printed content looks the
 * same as the editor. We copy every <link rel="stylesheet"> and inline
 * <style> element from the host document into the print iframe.
 */
function collectDocumentStyles(): string {
  if (typeof document === 'undefined') return ''

  const nodes = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]'),
  )

  return nodes
    .map((node) => {
      if (node.tagName === 'LINK') {
        const href = (node as HTMLLinkElement).href
        return href ? `<link rel="stylesheet" href="${href}">` : ''
      }
      return node.outerHTML
    })
    .join('\n')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Build the full HTML document for the print iframe.
 * The content is wrapped in `.cliveedit .ce-viewer__content` so the
 * shipped editor styles apply, matching the read-only viewer output.
 */
export function buildPrintDocument(markdown: string, options?: PrintOptions): string {
  const body = parseMarkdown(markdown, options)
  const styles = collectDocumentStyles()
  const title = options?.title ? escapeHtml(options.title) : 'Print'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
${styles}
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  .ce-print { padding: 24px; }
  @media print {
    .ce-print { padding: 0; }

    /* Keep atomic blocks intact across page breaks where the browser
       supports it. Code blocks, tables, images and blockquotes read
       poorly when split, so we ask the layout engine to keep each one
       on a single page whenever it fits. */
    .ce-viewer__content pre,
    .ce-viewer__content table,
    .ce-viewer__content blockquote,
    .ce-viewer__content img,
    .ce-viewer__content li {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Never leave a heading stranded at the bottom of a page —
       keep it with the content that follows. */
    .ce-viewer__content h1,
    .ce-viewer__content h2,
    .ce-viewer__content h3,
    .ce-viewer__content h4,
    .ce-viewer__content h5,
    .ce-viewer__content h6 {
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Avoid orphan/widow single lines inside paragraphs. */
    .ce-viewer__content p {
      orphans: 3;
      widows: 3;
    }

    /* Table headers repeat on each printed page. */
    .ce-viewer__content thead {
      display: table-header-group;
    }
  }
</style>
</head>
<body>
<div class="cliveedit ce-print">
  <div class="ce-viewer__content">${body}</div>
</div>
</body>
</html>`
}

/**
 * Open an isolated print view for the given markdown and trigger the
 * browser print dialog. Returns the iframe element that was created
 * (or `null` when running without a DOM, e.g. SSR).
 *
 * The host page and editor state are never modified — everything happens
 * inside a temporary, off-screen iframe that is removed afterwards.
 */
export function printMarkdown(markdown: string, options?: PrintOptions): HTMLIFrameElement | null {
  if (typeof document === 'undefined') return null

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'

  const cleanup = () => {
    // Guard against double removal (afterprint + fallback timeout)
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe)
    }
  }

  const triggerPrint = () => {
    const win = iframe.contentWindow
    if (!win) {
      cleanup()
      return
    }

    win.addEventListener('afterprint', cleanup)

    try {
      win.focus()
      win.print()
    } catch {
      // If printing is unavailable (e.g. jsdom) just clean up.
      cleanup()
      return
    }

    // Fallback cleanup for browsers that never fire `afterprint`.
    win.setTimeout(cleanup, 60_000)
  }

  iframe.addEventListener('load', triggerPrint)

  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    // Could not access the iframe document — abort cleanly.
    cleanup()
    return null
  }

  doc.open()
  doc.write(buildPrintDocument(markdown, options))
  doc.close()

  return iframe
}
