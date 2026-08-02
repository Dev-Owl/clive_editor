/* ================================================================== */
/*  codeCopy.ts — copy-to-clipboard button for rendered code blocks     */
/* ================================================================== */

/*
 * The viewer renders markdown with `v-html`, so the buttons are part of that
 * markup and cannot carry Vue listeners.  They are injected into the HTML
 * here and handled through one delegated click listener on the container.
 */

export const COPY_BUTTON_CLASS = 'ce-code-copy'

const COPY_LABEL = 'Copy code'
const COPIED_LABEL = 'Copied'
const FEEDBACK_DURATION = 1600

/** Zero-width sentinel the editor keeps at the end of empty code lines. */
const CARET_SENTINEL = /​/g

const COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<rect x="9" y="9" width="12" height="12" rx="2"/>'
  + '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'

const COPIED_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M20 6 9 17l-5-5"/></svg>'

/**
 * Add a copy button to every code block in a rendered HTML string.
 * Returns the HTML unchanged when there is no DOM to work with (SSR).
 */
export function addCodeCopyButtons(html: string): string {
  if (typeof document === 'undefined') return html

  const container = document.createElement('div')
  container.innerHTML = html

  for (const pre of Array.from(container.querySelectorAll('pre'))) {
    if (!pre.querySelector('code')) continue
    if (pre.querySelector(`.${COPY_BUTTON_CLASS}`)) continue

    // Marks the block so the language label can make room for the button
    pre.classList.add('ce-has-code-copy')
    pre.appendChild(createCopyButton())
  }

  return container.innerHTML
}

function createCopyButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = COPY_BUTTON_CLASS
  button.setAttribute('aria-label', COPY_LABEL)
  button.setAttribute('title', COPY_LABEL)
  button.innerHTML = COPY_ICON
  return button
}

/** The copy button for an event target, or null when it was a plain click. */
export function findCopyButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest(`.${COPY_BUTTON_CLASS}`)
}

/** Read the code of the block a button belongs to. */
export function getCodeBlockText(button: HTMLElement): string {
  const codeEl = button.closest('pre')?.querySelector('code')
  return (codeEl?.textContent ?? '').replace(CARET_SENTINEL, '')
}

let feedbackTimer: ReturnType<typeof setTimeout> | null = null
let feedbackButton: HTMLElement | null = null

/** Copy the button's code block and confirm it on the button. */
export async function copyCodeBlock(button: HTMLElement): Promise<boolean> {
  const text = getCodeBlockText(button)
  if (!text) return false

  const copied = await writeToClipboard(text)
  if (copied) showCopiedFeedback(button)
  return copied
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or an insecure context — fall back below
  }
  return copyWithSelection(text)
}

/** Clipboard API fallback for insecure contexts (plain http, older browsers). */
function copyWithSelection(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  textarea.remove()
  return copied
}

function showCopiedFeedback(button: HTMLElement): void {
  clearCopyFeedback()

  feedbackButton = button
  button.classList.add('is-copied')
  button.setAttribute('aria-label', COPIED_LABEL)
  button.setAttribute('title', COPIED_LABEL)
  button.innerHTML = COPIED_ICON

  feedbackTimer = setTimeout(clearCopyFeedback, FEEDBACK_DURATION)
}

/** Reset the confirmation state — also called when the viewer unmounts. */
export function clearCopyFeedback(): void {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
  if (!feedbackButton) return

  // Safe even when the markup was re-rendered in the meantime: the element is
  // then detached and nobody sees the reset
  feedbackButton.classList.remove('is-copied')
  feedbackButton.setAttribute('aria-label', COPY_LABEL)
  feedbackButton.setAttribute('title', COPY_LABEL)
  feedbackButton.innerHTML = COPY_ICON
  feedbackButton = null
}
