/* ================================================================== */
/*  renderSanitizer.ts — final sanitising layer for rendered HTML      */
/*                                                                     */
/*  Everything parseMarkdown produces passes through here before it    */
/*  reaches v-html / innerHTML / the print view, so one missed escape  */
/*  in a renderer can no longer turn into script execution.            */
/* ================================================================== */

import createDOMPurify, { type Config, type DOMPurify } from 'dompurify'

/**
 * Turns rendered HTML into HTML that is safe to insert into the page.
 * Pass your own to `CliveEdit`, `MarkdownViewer`, `parseMarkdown` or
 * `printMarkdown` to replace the default DOMPurify-based sanitiser.
 */
export type SanitizeFn = (html: string) => string

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])
// Matches what slugify() produces: letters of any script, digits, `_`, `-`
const HEADING_ID_RE = /^[\p{L}\p{M}\p{N}\p{Pc}-]+$/u

const CONFIG: Config = {
  // Code block language labels are rendered as `contenteditable="false"`
  ADD_ATTR: ['contenteditable'],
}

// A private instance, so our hooks never leak into a DOMPurify the host
// application uses itself
let purifier: DOMPurify | null = null

function getPurifier(): DOMPurify | null {
  if (purifier) return purifier
  if (typeof window === 'undefined') return null

  purifier = createDOMPurify(window)
  purifier.addHook('uponSanitizeAttribute', (node, data) => {
    // Only the "not editable" marker is needed — content must not be able
    // to make parts of the viewer editable
    if (data.attrName === 'contenteditable' && data.attrValue !== 'false') {
      data.keepAttr = false
      return
    }

    // DOMPurify drops ids that shadow document properties (e.g. `title`,
    // `cookie`). Heading anchors are slugs of the heading text and must
    // survive, so keep them as long as they are plain slugs.
    if (
      data.attrName === 'id'
      && HEADING_TAGS.has((node as Element).nodeName)
      && HEADING_ID_RE.test(data.attrValue)
    ) {
      data.forceKeepAttr = true
    }
  })
  return purifier
}

/**
 * Default sanitiser: DOMPurify with an allowlist that keeps everything the
 * editor renders (code block labels, image sizing, table alignment, Shiki
 * styles, heading anchors).
 *
 * Without a DOM (server-side rendering) DOMPurify cannot run and the HTML is
 * returned unchanged; pass a server-capable `sanitize` function for SSR.
 */
export function sanitizeRenderedHtml(html: string): string {
  const instance = getPurifier()
  if (!instance?.isSupported) return html
  return instance.sanitize(html, CONFIG) as string
}
