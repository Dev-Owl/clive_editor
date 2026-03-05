/* ================================================================== */
/*  emojiPicker.ts — emoji-picker-element dynamic loader               */
/*                                                                     */
/*  emoji-picker-element is an optional peer dependency.  If not       */
/*  installed the dynamic import fails silently and the emoji button   */
/*  is never shown.                                                    */
/* ================================================================== */

export interface EmojiPickerOptions {
  /** Emoji data locale (default: 'en') */
  locale?: string
  /** URL to fetch emoji data from (default: jsdelivr CDN) */
  dataSource?: string
}

let pickerModule: any = null

/**
 * Try to load emoji-picker-element.  Returns `true` on success, `false`
 * if the package is not installed or fails to load.
 */
export async function initEmojiPicker(): Promise<boolean> {
  if (pickerModule) return true
  try {
    pickerModule = await import('emoji-picker-element')
    return true
  } catch {
    pickerModule = null
    return false
  }
}

/**
 * Create a configured `<emoji-picker>` custom-element instance.
 * Call only after a successful `initEmojiPicker()`.
 */
export function createPickerElement(options?: EmojiPickerOptions): HTMLElement | null {
  if (!pickerModule) return null

  const el = document.createElement('emoji-picker')

  if (options?.locale) {
    el.setAttribute('locale', options.locale)
  }
  if (options?.dataSource) {
    el.setAttribute('data-source', options.dataSource)
  }

  // Dark / light class is applied later by EmojiPicker.vue based on
  // the editor's computed background — no manual darkMode option needed.

  return el
}

/** Whether emoji-picker-element has been loaded successfully. */
export function isEmojiPickerAvailable(): boolean {
  return pickerModule !== null
}
