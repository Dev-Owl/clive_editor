import { mount } from '@vue/test-utils'
import { CalendarClock } from '@lucide/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CliveEdit from '@/components/CliveEdit.vue'
import * as printUtil from '@/utils/print'
import type { ToolbarItem } from '@/types'

describe('CliveEdit custom toolbar integration', () => {
  it('allows a custom toolbar button to insert text in markdown mode', async () => {
    const toolbarItems: ToolbarItem[] = [
      {
        id: 'insert-date-time',
        label: 'Insert Date/Time',
        icon: CalendarClock,
        onClick: (ctx) => {
          ctx.insertText('2026-03-20 09:00')
        },
      },
    ]

    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: '',
        mode: 'markdown',
        toolbarItems,
      },
    })

    await wrapper.get('button[aria-label="Insert Date/Time"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-03-20 09:00'])
  })

  it('allows a custom toolbar button to insert markdown in markdown mode', async () => {
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
      props: {
        modelValue: '',
        mode: 'markdown',
        toolbarItems,
      },
    })

    await wrapper.get('button[aria-label="Insert Markdown"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['**bold**'])
  })
})

describe('CliveEdit print action', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.querySelectorAll('iframe').forEach((el) => el.remove())
  })

  it('opens a print view with the current markdown when the toolbar button is clicked', async () => {
    const spy = vi.spyOn(printUtil, 'printMarkdown').mockReturnValue(null)

    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: '# Hello world',
        mode: 'markdown',
      },
    })

    await wrapper.get('button[aria-label="Print"]').trigger('click')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe('# Hello world')
  })

  it('prints even when the editor is disabled', async () => {
    const spy = vi.spyOn(printUtil, 'printMarkdown').mockReturnValue(null)

    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: 'Read only content',
        mode: 'markdown',
        disabled: true,
      },
    })

    await wrapper.get('button[aria-label="Print"]').trigger('click')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe('Read only content')
  })

  it('does not mutate the model value when printing', async () => {
    vi.spyOn(printUtil, 'printMarkdown').mockReturnValue(null)

    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: '# Unchanged',
        mode: 'markdown',
      },
    })

    await wrapper.get('button[aria-label="Print"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('exposes a programmatic print() method', () => {
    const spy = vi.spyOn(printUtil, 'printMarkdown').mockReturnValue(null)

    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: '# Programmatic',
        mode: 'markdown',
      },
    })

    ;(wrapper.vm as unknown as { print: () => void }).print()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe('# Programmatic')
  })
})
