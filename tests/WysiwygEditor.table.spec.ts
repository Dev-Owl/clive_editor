import { mount } from '@vue/test-utils'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WysiwygEditor from '@/components/WysiwygEditor.vue'
import { setBackwardSelection, setCollapsedSelection, setSelection } from './helpers/wysiwyg'

function mockSelectionRange(range: Range): MockInstance {
  const selection = window.getSelection()
  if (!selection) throw new Error('Selection API is unavailable in this test')
  return vi.spyOn(selection, 'getRangeAt').mockImplementation((index: number) => {
    if (index !== 0) throw new DOMException('Invalid range index', 'IndexSizeError')
    return range
  })
}

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

  it('keeps the caret at the deletion point for backward selections inside a table cell', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A | B |\n| --- | --- |\n| One | Two |',
      },
    })

    const cells = wrapper.findAll('td')
    const firstText = cells[0].element.firstChild!
    setBackwardSelection(firstText, 3, firstText, 1)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'Backspace' })
    vi.runAllTimers()

    const selection = window.getSelection()
    expect(cells[0].text()).toBe('O')
    expect(selection?.isCollapsed).toBe(true)
    expect(cells[0].element.contains(selection?.anchorNode ?? null) || selection?.anchorNode === cells[0].element).toBe(true)
    expect(cells[1].text()).toBe('Two')
    wrapper.unmount()
  })

  it('uses the in-cell selection endpoints when the range start is reported on the row', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A | B |\n| --- | --- |\n| One | Two |',
      },
    })

    const cells = wrapper.findAll('td')
    const row = wrapper.get('tr').element
    const firstText = cells[0].element.firstChild!
    setBackwardSelection(firstText, 3, firstText, 1)

    const weirdRange = document.createRange()
    weirdRange.setStart(row, 0)
    weirdRange.setEnd(firstText, 3)
    const rangeSpy = mockSelectionRange(weirdRange)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'Backspace' })
    vi.runAllTimers()

    const selection = window.getSelection()
    expect(cells[0].text()).toBe('O')
    expect(cells[1].text()).toBe('Two')
    expect(selection?.isCollapsed).toBe(true)
    expect(cells[0].element.contains(selection?.anchorNode ?? null) || selection?.anchorNode === cells[0].element).toBe(true)

    rangeSpy.mockRestore()
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

  it('uses the in-cell selection endpoints when the range end is reported on the row', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A | B |\n| --- | --- |\n| One | Two |',
      },
    })

    const cells = wrapper.findAll('td')
    const row = wrapper.get('tr').element
    const secondText = cells[1].element.firstChild!
    setSelection(secondText, 0, secondText, 2)

    const weirdRange = document.createRange()
    weirdRange.setStart(secondText, 0)
    weirdRange.setEnd(row, 2)
    const rangeSpy = mockSelectionRange(weirdRange)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'x' })
    vi.runAllTimers()

    const selection = window.getSelection()
    expect(cells[0].text()).toBe('One')
    expect(cells[1].text()).toBe('xo')
    expect(selection?.isCollapsed).toBe(true)
    expect(cells[1].element.contains(selection?.anchorNode ?? null) || selection?.anchorNode === cells[1].element).toBe(true)

    rangeSpy.mockRestore()
    wrapper.unmount()
  })

  it('replaces selected text at the same position inside a table cell', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '| A |\n| --- |\n| Three |',
      },
    })

    const cell = wrapper.get('td')
    const text = cell.element.firstChild!
    setSelection(text, 1, text, 3)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'x' })
    vi.runAllTimers()

    expect(cell.text()).toBe('Txee')
    const selection = window.getSelection()
    expect(selection?.isCollapsed).toBe(true)
    expect(cell.element.contains(selection?.anchorNode ?? null) || selection?.anchorNode === cell.element).toBe(true)
    wrapper.unmount()
  })

  it('exits a top-level empty list item inside a table cell', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<table><tbody><tr><td><ul><li>Cell</li><li><br></li></ul></td></tr></tbody></table>'
    const emptyItem = editor.element.querySelector('td li:last-child')!
    setCollapsedSelection(emptyItem, 0)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.querySelector('td')?.innerHTML).toBe('<ul><li>Cell</li></ul><br>')
    wrapper.unmount()
  })

  it('outdents an empty nested list item inside a table cell', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<table><tbody><tr><td><ul><li>Cell<ul><li><br></li></ul></li></ul></td></tr></tbody></table>'
    const emptyNestedItem = editor.element.querySelector('td ul ul li')!
    setCollapsedSelection(emptyNestedItem, 0)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.querySelector('td')?.innerHTML).toBe('<ul><li>Cell</li><li><br></li></ul>')
    wrapper.unmount()
  })
})
