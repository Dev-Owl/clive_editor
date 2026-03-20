import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WysiwygEditor from '@/components/WysiwygEditor.vue'

function setCollapsedSelection(node: Node, offset = 0) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe('WysiwygEditor keyboard flows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('emits indent and outdent actions when tabbing inside a list item', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '- One\n- Two',
      },
    })

    const secondItem = wrapper.findAll('li')[1]
    setCollapsedSelection(secondItem.element.firstChild!, 0)

    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'Tab' })
    await wrapper.get('.ce-wysiwyg').trigger('keydown', { key: 'Tab', shiftKey: true })

    expect(wrapper.emitted('action')?.map(([value]) => value)).toEqual(['indentList', 'outdentList'])
    wrapper.unmount()
  })

  it('creates a heading when typing # followed by space', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.textContent = '#'
    setCollapsedSelection(editor.element.firstChild!, 1)

    await editor.trigger('keydown', { key: ' ' })
    vi.runAllTimers()

    expect(wrapper.find('.ce-wysiwyg h1').exists()).toBe(true)
    wrapper.unmount()
  })

  it('creates a bullet list when typing dash followed by space', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.textContent = '-'
    setCollapsedSelection(editor.element.firstChild!, 1)

    await editor.trigger('keydown', { key: ' ' })
    vi.runAllTimers()

    expect(wrapper.find('.ce-wysiwyg ul > li').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens a link on ctrl click', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '[Example](https://example.com)',
      },
    })

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    await wrapper.get('.ce-wysiwyg a').trigger('click', { ctrlKey: true })

    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
    wrapper.unmount()
  })
})
