import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WysiwygEditor from '@/components/WysiwygEditor.vue'
import { setCollapsedSelection, setSelection } from './helpers/wysiwyg'

describe('WysiwygEditor table flows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('moves to the next table cell on Tab', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A | B |\n| --- | --- |\n| One | Two |',
      },
    })

    const cells = wrapper.findAll('td')
    setCollapsedSelection(cells[0].element.firstChild!, 0)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'Tab' })

    const selection = window.getSelection()
    expect(cells[1].element.contains(selection?.anchorNode ?? null) || selection?.anchorNode === cells[1].element).toBe(true)
    wrapper.unmount()
  })

  it('moves to the previous table cell on Shift+Tab', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A | B |\n| --- | --- |\n| One | Two |',
      },
    })

    const cells = wrapper.findAll('td')
    setCollapsedSelection(cells[1].element.firstChild!, 0)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'Tab', shiftKey: true })

    const selection = window.getSelection()
    expect(cells[0].element.contains(selection?.anchorNode ?? null) || selection?.anchorNode === cells[0].element).toBe(true)
    wrapper.unmount()
  })

  it('inserts a line break instead of a new block on Enter inside a table cell', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A |\n| --- |\n| One |',
      },
    })

    const cell = wrapper.get('td')
    setCollapsedSelection(cell.element.firstChild!, 3)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(cell.element.innerHTML).toBe('One<br>')
    wrapper.unmount()
  })

  it('deletes only the selected text inside a single table cell', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A | B |\n| --- | --- |\n| One | Two |',
      },
    })

    const cells = wrapper.findAll('td')
    const firstText = cells[0].element.firstChild!
    setSelection(firstText, 1, firstText, 3)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'Delete' })
    vi.runAllTimers()

    expect(cells[0].text()).toBe('O')
    expect(cells[1].text()).toBe('Two')
    wrapper.unmount()
  })

  it('replaces the selected text inside a single table cell with typed input', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A | B |\n| --- | --- |\n| One | Two |',
      },
    })

    const cells = wrapper.findAll('td')
    const firstText = cells[0].element.firstChild!
    setSelection(firstText, 1, firstText, 3)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'x' })
    vi.runAllTimers()

    expect(cells[0].text()).toBe('Ox')
    expect(cells[1].text()).toBe('Two')
    wrapper.unmount()
  })
})
