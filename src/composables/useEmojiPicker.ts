/* ================================================================== */
/*  useEmojiPicker — composable for optional emoji picker feature      */
/*                                                                     */
/*  Mirrors the useHighlighter pattern: wraps the dynamic import in    */
/*  reactive refs so the toolbar can conditionally render the emoji     */
/*  button only when the package is available.                         */
/* ================================================================== */

import { ref } from 'vue'
import {
  initEmojiPicker,
  isEmojiPickerAvailable,
  type EmojiPickerOptions,
} from '@/utils/emojiPicker'

export function useEmojiPicker() {
  const isReady = ref(isEmojiPickerAvailable())
  const enabled = ref(false)

  /**
   * Attempt to load emoji-picker-element.  Safe to call multiple times —
   * subsequent calls are no-ops once the module has loaded.
   */
  async function init(options?: EmojiPickerOptions): Promise<boolean> {
    if (isReady.value) {
      enabled.value = true
      return true
    }
    const ok = await initEmojiPicker()
    if (ok) {
      isReady.value = true
      enabled.value = true
    }
    return ok
  }

  function setEnabled(value: boolean): void {
    enabled.value = value
  }

  return {
    /** Whether emoji-picker-element has been loaded */
    isReady,
    /** Whether the emoji feature is currently enabled */
    enabled,
    /** Load the module and enable the feature */
    init,
    /** Enable / disable without re-loading */
    setEnabled,
  }
}
