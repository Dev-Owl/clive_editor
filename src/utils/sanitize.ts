/* ================================================================== */
/*  sanitize.ts — HTML sanitisation for paste events                   */
/*                                                                     */
/*  Strips dangerous elements and attributes from untrusted HTML       */
/*  before it enters the contenteditable region.                       */
/* ================================================================== */

/** Tags that are always removed (including their content). */
const REMOVE_WITH_CONTENT = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET',
  'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON',
  'LINK', 'META', 'NOSCRIPT',
])

/** Attributes that are allowed to stay. Everything else is stripped. */
const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'width', 'height',
  'colspan', 'rowspan', 'class',
])

/**
 * Sanitise an HTML string: remove dangerous tags, on-event handlers,
 * and non-whitelisted attributes.
 */
export function sanitizeHtml(dirty: string): string {
  const doc = new DOMParser().parseFromString(dirty, 'text/html')
  cleanNode(doc.body)
  return doc.body.innerHTML
}

/* ---------- Internal ---------- */

function cleanNode(node: Node): void {
  const children = Array.from(node.childNodes)

  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement

      // Remove dangerous elements entirely
      if (REMOVE_WITH_CONTENT.has(el.tagName)) {
        el.remove()
        continue
      }

      // Strip all attributes that are not white-listed
      const attrs = Array.from(el.attributes)
      for (const attr of attrs) {
        const name = attr.name.toLowerCase()

        // Remove event handlers (onclick, onload, etc.)
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
          continue
        }

        // Remove style attribute
        if (name === 'style') {
          el.removeAttribute(attr.name)
          continue
        }

        // Remove non-whitelisted attributes
        if (!ALLOWED_ATTRS.has(name)) {
          el.removeAttribute(attr.name)
          continue
        }

        // Sanitise href / src — block javascript: URIs
        if (name === 'href' || name === 'src') {
          const val = attr.value.trim().toLowerCase()
          if (val.startsWith('javascript:') || val.startsWith('data:text/html')) {
            el.removeAttribute(attr.name)
          }
        }
      }

      // Recurse
      cleanNode(el)

    } else if (child.nodeType === Node.COMMENT_NODE) {
      // Remove HTML comments
      child.parentNode?.removeChild(child)
    }
  }
}
