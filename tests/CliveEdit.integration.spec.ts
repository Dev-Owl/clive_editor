import { flushPromises, mount } from '@vue/test-utils'
import { Bold, CalendarClock } from 'lucide-vue-next'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToolbarItem } from '@/types'

const mockControls = vi.hoisted(() => ({
  highlightReady: null as unknown as Ref<boolean>,
  highlightEnabled: null as unknown as Ref<boolean>,
  emojiReady: null as unknown as Ref<boolean>,
  emojiEnabled: null as unknown as Ref<boolean>,
  initHighlighter: vi.fn(async (_options?: unknown) => {
    mockControls.highlightReady.value = true
    mockControls.highlightEnabled.value = true
    return true
  }),
  setHighlightEnabled: vi.fn((value: boolean) => {
    mockControls.highlightEnabled.value = value
  }),
  setHighlightDarkMode: vi.fn(),
  provideHighlight: vi.fn(),
  highlight: vi.fn(),
  initEmojiPicker: vi.fn(async (_options?: unknown) => {
    mockControls.emojiReady.value = true
    mockControls.emojiEnabled.value = true
    return true
  }),
  setEmojiEnabled: vi.fn((value: boolean) => {
    mockControls.emojiEnabled.value = value
  }),
}))

vi.mock('@/composables/useHighlighter', async () => {
  const { computed, ref } = await import('vue')

  mockControls.highlightReady = ref(false)
  mockControls.highlightEnabled = ref(false)

  return {
    useHighlighter: () => ({
      init: mockControls.initHighlighter,
      highlight: mockControls.highlight,
      isReady: mockControls.highlightReady,
      enabled: mockControls.highlightEnabled,
      highlightFn: computed(() => {
        if (!mockControls.highlightReady.value || !mockControls.highlightEnabled.value) return null
        return (code: string, lang: string) => `<pre><code class="mock-highlight" data-lang="${lang}">${code}</code></pre>`
      }),
      setEnabled: mockControls.setHighlightEnabled,
      setDarkMode: mockControls.setHighlightDarkMode,
      provideHighlight: mockControls.provideHighlight,
    }),
  }
})

vi.mock('@/composables/useEmojiPicker', async () => {
  const { ref } = await import('vue')

  mockControls.emojiReady = ref(false)
  mockControls.emojiEnabled = ref(false)

  return {
    useEmojiPicker: () => ({
      isReady: mockControls.emojiReady,
      enabled: mockControls.emojiEnabled,
      init: mockControls.initEmojiPicker,
      setEnabled: mockControls.setEmojiEnabled,
    }),
  }
})

import CliveEdit from '@/components/CliveEdit.vue'

const emojiPickerStub = {
  name: 'EmojiPicker',
  props: ['visible'],
  template: '<button v-if="visible" type="button" class="emoji-stub" @click="$emit(\'select\', \'😀\')">Pick Emoji</button>',
}

function setTextareaSelection(textarea: HTMLTextAreaElement, start: number, end = start) {
  textarea.selectionStart = start
  textarea.selectionEnd = end
}

function setTextSelection(node: Node, start: number, end = start) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

async function settle() {
  await flushPromises()
  await nextTick()
  await nextTick()
}

describe('CliveEdit orchestration integration', () => {
  beforeEach(() => {
    mockControls.highlightReady.value = false
    mockControls.highlightEnabled.value = false
    mockControls.emojiReady.value = false
    mockControls.emojiEnabled.value = false
    mockControls.initHighlighter.mockClear()
    mockControls.setHighlightEnabled.mockClear()
    mockControls.setHighlightDarkMode.mockClear()
    mockControls.provideHighlight.mockClear()
    mockControls.highlight.mockClear()
    mockControls.initEmojiPicker.mockClear()
    mockControls.setEmojiEnabled.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('blocks toolbar actions and keyboard shortcuts when disabled', async () => {
    const onClick = vi.fn()
    const toolbarItems: ToolbarItem[] = [
      { id: 'bold', label: 'Bold', icon: Bold, action: 'bold' },
      { id: 'custom', label: 'Custom', icon: CalendarClock, onClick },
    ]

    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: 'Hello',
        mode: 'markdown',
        disabled: true,
        toolbarItems,
      },
    })

    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    setTextareaSelection(textarea, 0, 5)

    expect(wrapper.get('button[aria-label="Bold"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Custom"]').attributes('disabled')).toBeDefined()

    await wrapper.get('.ce-editor-wrap').trigger('keydown', { key: 'b', ctrlKey: true })
    await wrapper.get('button[aria-label="Custom"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('routes root keyboard shortcuts in markdown mode and supports undo/redo', async () => {
    const Harness = defineComponent({
      components: { CliveEdit },
      setup() {
        const value = ref('Hello')
        return { value }
      },
      template: '<CliveEdit v-model="value" mode="markdown" />',
    })

    const wrapper = mount(Harness, {
      attachTo: document.body,
    })

    const root = wrapper.get('.ce-editor-wrap')
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement

    setTextareaSelection(textarea, 0, 5)
    await root.trigger('keydown', { key: 'b', ctrlKey: true })
    await settle()
    expect((wrapper.vm as { value: string }).value).toBe('**Hello**')

    setTextareaSelection(textarea, 2, 7)
    await root.trigger('keydown', { key: 'i', ctrlKey: true })
    await settle()
    expect((wrapper.vm as { value: string }).value).toBe('***Hello***')

    setTextareaSelection(textarea, 0, 11)
    await root.trigger('keydown', { key: 'k', ctrlKey: true })
    await settle()
    expect((wrapper.vm as { value: string }).value).toBe('[***Hello***](url)')

    await root.trigger('keydown', { key: 'z', ctrlKey: true })
    await settle()
    expect((wrapper.vm as { value: string }).value).toBe('***Hello***')

    await root.trigger('keydown', { key: 'Z', ctrlKey: true, shiftKey: true })
    await settle()
    expect((wrapper.vm as { value: string }).value).toBe('[***Hello***](url)')
  })

  it('integrates undo and redo in visual mode after a real formatting change', async () => {
    const Harness = defineComponent({
      components: { CliveEdit },
      setup() {
        const value = ref('Hello')
        return { value }
      },
      template: '<CliveEdit v-model="value" mode="wysiwyg" />',
    })

    const wrapper = mount(Harness, {
      attachTo: document.body,
    })

    const textNode = wrapper.get('.ce-wysiwyg p').element.firstChild!
    setTextSelection(textNode, 0, 5)

    await wrapper.get('button[aria-label="Bold"]').trigger('click')
    await settle()
    expect((wrapper.vm as { value: string }).value).toBe('**Hello**')

    await wrapper.get('button[aria-label="Undo"]').trigger('click')
    await settle()
    expect((wrapper.vm as { value: string }).value).toBe('Hello')

    await wrapper.get('button[aria-label="Redo"]').trigger('click')
    await settle()
    expect((wrapper.vm as { value: string }).value).toBe('**Hello**')
  })

  it('syncs external mode prop changes to the active editor', async () => {
    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: 'Hello',
        mode: 'wysiwyg',
      },
    })

    expect(wrapper.get('.ce-wysiwyg').isVisible()).toBe(true)

    await wrapper.setProps({ mode: 'markdown' })
    await settle()

    expect(wrapper.get('textarea').isVisible()).toBe(true)
    expect(wrapper.get('.ce-wysiwyg').isVisible()).toBe(false)
  })

  it('syncs current visual content before switching to markdown mode', async () => {
    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: 'Hello',
        mode: 'wysiwyg',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg').element as HTMLElement
    editor.innerHTML = '<p><strong>Hello</strong> there</p>'

    await wrapper.get('button[aria-label="Switch to Markdown mode"]').trigger('click')
    await settle()

    expect(wrapper.emitted('update:modelValue')?.map(([value]) => value)).toContain('**Hello** there')
    expect(wrapper.emitted('update:mode')).toEqual([['markdown']])
    expect(wrapper.get('textarea').isVisible()).toBe(true)
  })

  it('exposes public editor methods for state, focus, and history control', async () => {
    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: 'Hello',
        mode: 'markdown',
      },
    })

    const api = wrapper.vm as unknown as {
      getMarkdown: () => string
      getMode: () => string
      focus: () => void
      undo: () => void
      redo: () => void
    }

    expect(api.getMarkdown()).toBe('Hello')
    expect(api.getMode()).toBe('markdown')

    api.focus()
    expect(document.activeElement).toBe(wrapper.get('textarea').element)

    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    setTextareaSelection(textarea, 0, 5)
    await wrapper.get('button[aria-label="Bold"]').trigger('click')
    await settle()

    api.undo()
    await settle()
    api.redo()
    await settle()

    expect(wrapper.emitted('update:modelValue')?.map(([value]) => value)).toContain('**Hello**')
  })

  it('opens the emoji picker and inserts an emoji in markdown mode', async () => {
    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: '',
        mode: 'markdown',
        emojiPicker: true,
      },
      global: {
        stubs: {
          Teleport: true,
          EmojiPicker: emojiPickerStub,
        },
      },
    })

    await settle()

    expect(mockControls.initEmojiPicker).toHaveBeenCalled()
    await wrapper.get('button[aria-label="Emoji"]').trigger('click')
    await wrapper.get('.emoji-stub').trigger('click')
    await settle()

    expect(wrapper.emitted('update:modelValue')?.map(([value]) => value)).toContain('😀')
  })

  it('opens the emoji picker and inserts an emoji in visual mode', async () => {
    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: '',
        mode: 'wysiwyg',
        emojiPicker: true,
      },
      global: {
        stubs: {
          Teleport: true,
          EmojiPicker: emojiPickerStub,
        },
      },
    })

    const editor = wrapper.get('.ce-wysiwyg').element as HTMLElement
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn((_command: string, _showUi: boolean, value?: string) => {
        editor.textContent = `${editor.textContent ?? ''}${value ?? ''}`
        return true
      }),
    })

    await settle()
    await wrapper.get('button[aria-label="Emoji"]').trigger('click')
    await wrapper.get('.emoji-stub').trigger('click')
    await settle()

    expect(wrapper.emitted('update:modelValue')?.map(([value]) => value)).toContain('😀')
  })

  it('reacts to highlight option changes after mount', async () => {
    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: '```ts\nconst x = 1\n```',
        mode: 'wysiwyg',
      },
    })

    await wrapper.setProps({
      highlightOptions: {
        theme: 'github-light',
        darkMode: true,
      },
    })
    await settle()

    expect(mockControls.initHighlighter).toHaveBeenCalledWith({
      theme: 'github-light',
      darkMode: true,
    })
    expect(mockControls.setHighlightDarkMode).toHaveBeenCalledWith(true)

    await wrapper.setProps({
      highlightOptions: undefined,
    })
    await settle()

    expect(mockControls.setHighlightEnabled).toHaveBeenCalledWith(false)
  })
})
