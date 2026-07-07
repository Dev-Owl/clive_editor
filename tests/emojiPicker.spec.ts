import { afterEach, describe, expect, it, vi } from 'vitest'

/* ------------------------------------------------------------------ */
/*  emoji-picker-element is an optional peer dependency. We mock the   */
/*  dynamic import so the loader logic can be tested without it.       */
/* ------------------------------------------------------------------ */

describe('emojiPicker loader (package available)', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('emoji-picker-element')
  })

  it('initializes, reports availability, and builds a configured element', async () => {
    vi.doMock('emoji-picker-element', () => ({ default: {} }))
    const mod = await import('@/utils/emojiPicker')

    // Not available until init succeeds.
    expect(mod.isEmojiPickerAvailable()).toBe(false)
    expect(mod.createPickerElement()).toBeNull()

    const ok = await mod.initEmojiPicker()
    expect(ok).toBe(true)
    expect(mod.isEmojiPickerAvailable()).toBe(true)

    // Second init is a no-op that still returns true.
    expect(await mod.initEmojiPicker()).toBe(true)

    const el = mod.createPickerElement({ locale: 'de', dataSource: 'https://cdn.example/emoji.json' })
    expect(el).not.toBeNull()
    expect(el?.tagName.toLowerCase()).toBe('emoji-picker')
    expect(el?.getAttribute('locale')).toBe('de')
    expect(el?.getAttribute('data-source')).toBe('https://cdn.example/emoji.json')

    // Without options no attributes are set.
    const bare = mod.createPickerElement()
    expect(bare?.getAttribute('locale')).toBeNull()
    expect(bare?.getAttribute('data-source')).toBeNull()
  })
})

describe('emojiPicker loader (package missing)', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('emoji-picker-element')
  })

  it('degrades gracefully when the import fails', async () => {
    vi.doMock('emoji-picker-element', () => {
      throw new Error('not installed')
    })
    const mod = await import('@/utils/emojiPicker')

    const ok = await mod.initEmojiPicker()
    expect(ok).toBe(false)
    expect(mod.isEmojiPickerAvailable()).toBe(false)
    expect(mod.createPickerElement()).toBeNull()
  })
})
