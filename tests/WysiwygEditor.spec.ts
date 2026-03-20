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

function triggerPaste(
  wrapper: ReturnType<typeof mount>,
  {
    html = '',
    text = '',
  }: {
    html?: string
    text?: string
  },
) {
  return wrapper.get('.ce-wysiwyg').trigger('paste', {
    clipboardData: {
      files: [],
      getData: (type: string) => {
        if (type === 'text/html') return html
        if (type === 'text/plain') return text
        return ''
      },
    },
  })
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

  it('exits a root-level empty list item into a paragraph on Enter', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<ul><li>One</li><li><br></li></ul>'
    const emptyLi = wrapper.findAll('li')[1]
    setCollapsedSelection(emptyLi.element, 0)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<ul><li>One</li></ul><p><br></p>')
    wrapper.unmount()
  })

  it('exits an empty blockquote line into a new paragraph', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<blockquote><p>Quote</p><p><br></p></blockquote>'
    const emptyLine = editor.element.querySelectorAll('blockquote p')[1]
    setCollapsedSelection(emptyLine, 0)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<blockquote><p>Quote</p></blockquote><p><br></p>')
    wrapper.unmount()
  })

  it('splits a heading into a following paragraph on Enter', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<h2>Hello world</h2>'
    const text = editor.element.querySelector('h2')!.firstChild!
    setCollapsedSelection(text, 5)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    const heading = editor.element.querySelector('h2')
    const paragraph = editor.element.querySelector('p')
    expect(heading?.textContent).toBe('Hello')
    expect(paragraph?.textContent?.trim()).toBe('world')
    wrapper.unmount()
  })

  it('pastes plain text as escaped content with line breaks', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<p>Start</p>'
    const text = editor.element.querySelector('p')!.firstChild!
    setCollapsedSelection(text, 5)

    await triggerPaste(wrapper, {
      text: ' <b>Line 1</b>\nLine 2',
    })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toContain('<p>Start &lt;b&gt;Line 1&lt;/b&gt;<br>Line 2</p>')
    wrapper.unmount()
  })

  it('flattens pasted list items into the current list', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<ul><li>Start</li></ul>'
    const text = editor.element.querySelector('li')!.firstChild!
    setCollapsedSelection(text, 5)

    await triggerPaste(wrapper, {
      html: '<ul><li>Two</li><li>Three</li></ul>',
      text: 'Two\nThree',
    })
    vi.runAllTimers()

    const items = Array.from(editor.element.querySelectorAll('li')).map((item) => item.textContent?.trim())
    expect(items).toEqual(['Start', 'Two', 'Three'])
    expect(editor.element.querySelectorAll('ul')).toHaveLength(1)
    wrapper.unmount()
  })
})
