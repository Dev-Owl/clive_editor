/* ================================================================== */
/*  escape.ts — the one escape helper for hand-built HTML strings      */
/* ================================================================== */

/**
 * Escape a value for use in HTML text or in a quoted attribute value.
 * Covers every character that can end a text run or an attribute.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
