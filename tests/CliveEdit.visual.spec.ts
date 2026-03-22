import { mount } from '@vue/test-utils'
import { CalendarClock } from 'lucide-vue-next'
import { defineComponent, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CliveEdit from '@/components/CliveEdit.vue'
import type { ToolbarItem } from '@/types'

describe('CliveEdit visual mode integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows a custom toolbar button to insert text in visual mode', async () => {
    const toolbarItems: ToolbarItem[] = [
      {
        id: 'insert-date-time',
        label: 'Insert Date/Time',
        icon: CalendarClock,
        onClick: (ctx) => {
          ctx.insertText('2026-03-20 10:15')
        },
      },
    ]

    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: '',
        mode: 'wysiwyg',
        toolbarItems,
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

    await wrapper.get('button[aria-label="Insert Date/Time"]').trigger('click')
    await nextTick()
    await nextTick()

    const emitted = wrapper.emitted('update:modelValue')?.map(([value]) => value)
    expect(emitted).toContain('2026-03-20 10:15')

    wrapper.unmount()
  })

  it('keeps custom text insertion literal in visual mode', async () => {
    const toolbarItems: ToolbarItem[] = [
      {
        id: 'insert-literal-markdown',
        label: 'Insert Literal Markdown',
        icon: CalendarClock,
        onClick: (ctx) => {
          ctx.insertText('**bold**')
        },
      },
    ]

    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: '',
        mode: 'wysiwyg',
        toolbarItems,
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

    await wrapper.get('button[aria-label="Insert Literal Markdown"]').trigger('click')
    await nextTick()
    await nextTick()

    const emitted = wrapper.emitted('update:modelValue')?.map(([value]) => value)
    expect(emitted).toContain('\\*\\*bold\\*\\*')

    wrapper.unmount()
  })

  it('allows a custom toolbar button to insert markdown in visual mode', async () => {
    const toolbarItems: ToolbarItem[] = [
      {
        id: 'insert-markdown',
        label: 'Insert Markdown',
        icon: CalendarClock,
        onClick: (ctx) => {
          ctx.insertMarkdown('**bold**')
        },
      },
    ]

    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: 'Hello world',
        mode: 'wysiwyg',
        toolbarItems,
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    const textNode = editor.get('p').element.firstChild
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(textNode!, 6)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
    await editor.trigger('keyup')
    selection?.removeAllRanges()

    await wrapper.get('button[aria-label="Insert Markdown"]').trigger('click')
    await nextTick()
    await nextTick()

    const emitted = wrapper.emitted('update:modelValue')?.map(([value]) => value)
    expect(emitted).toContain('Hello **bold**world')

    wrapper.unmount()
  })

  it('applies bold from the toolbar in visual mode', async () => {
    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: 'Hello',
        mode: 'wysiwyg',
      },
    })

    const textNode = wrapper.get('.ce-wysiwyg p').element.firstChild
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(textNode!, 0)
    range.setEnd(textNode!, 5)
    selection?.removeAllRanges()
    selection?.addRange(range)

    await wrapper.get('button[aria-label="Bold"]').trigger('click')
    await nextTick()
    await nextTick()

    const emitted = wrapper.emitted('update:modelValue')?.map(([value]) => value)
    expect(emitted).toContain('**Hello**')

    wrapper.unmount()
  })

  it('applies heading 1 from the toolbar in visual mode', async () => {
    const wrapper = mount(CliveEdit, {
      attachTo: document.body,
      props: {
        modelValue: 'Hello',
        mode: 'wysiwyg',
      },
    })

    const textNode = wrapper.get('.ce-wysiwyg p').element.firstChild
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(textNode!, 5)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)

    await wrapper.get('button[aria-label="Heading 1"]').trigger('click')
    await nextTick()
    await nextTick()

    const emitted = wrapper.emitted('update:modelValue')?.map(([value]) => value)
    expect(emitted).toContain('# Hello')

    wrapper.unmount()
  })

  it('inserts text at the current markdown caret position', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0)
    })

    const toolbarItems: ToolbarItem[] = [
      {
        id: 'insert-date-time',
        label: 'Insert Date/Time',
        icon: CalendarClock,
        onClick: (ctx) => {
          ctx.insertText('2026-03-20')
        },
      },
    ]

    const Harness = defineComponent({
      components: { CliveEdit },
      setup() {
        const value = ref('Hello world')
        return { value, toolbarItems }
      },
      template: '<CliveEdit v-model="value" mode="markdown" :toolbar-items="toolbarItems" />',
    })

    const wrapper = mount(Harness, {
      attachTo: document.body,
    })

    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    textarea.selectionStart = 6
    textarea.selectionEnd = 6

    await wrapper.get('button[aria-label="Insert Date/Time"]').trigger('click')
    await nextTick()
    await nextTick()
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect((wrapper.vm as { value: string }).value).toBe('Hello 2026-03-20world')
    expect(textarea.selectionStart).toBe(16)
    expect(textarea.selectionEnd).toBe(16)

    wrapper.unmount()
  })

  it('inserts raw markdown at the current markdown caret position', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0)
    })

    const toolbarItems: ToolbarItem[] = [
      {
        id: 'insert-markdown',
        label: 'Insert Markdown',
        icon: CalendarClock,
        onClick: (ctx) => {
          ctx.insertMarkdown('**bold**')
        },
      },
    ]

    const Harness = defineComponent({
      components: { CliveEdit },
      setup() {
        const value = ref('Hello world')
        return { value, toolbarItems }
      },
      template: '<CliveEdit v-model="value" mode="markdown" :toolbar-items="toolbarItems" />',
    })

    const wrapper = mount(Harness, {
      attachTo: document.body,
    })

    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    textarea.selectionStart = 6
    textarea.selectionEnd = 6

    await wrapper.get('button[aria-label="Insert Markdown"]').trigger('click')
    await nextTick()
    await nextTick()
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect((wrapper.vm as { value: string }).value).toBe('Hello **bold**world')
    expect(textarea.selectionStart).toBe(14)
    expect(textarea.selectionEnd).toBe(14)

    wrapper.unmount()
  })
})
