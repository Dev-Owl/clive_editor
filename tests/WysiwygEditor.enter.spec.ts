import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WysiwygEditor from '@/components/WysiwygEditor.vue'
import { setCollapsedSelection } from './helpers/wysiwyg'

describe('WysiwygEditor enter flows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('exits an empty nested list item into the outer list', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<ul><li>Parent<ul><li><br></li></ul></li></ul>'
    const emptyNestedLi = editor.element.querySelector('ul ul li')!
    setCollapsedSelection(emptyNestedLi, 0)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<ul><li>Parent</li><li><br></li></ul>')
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

  it('converts an empty heading into a paragraph', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<h2><br></h2>'
    const heading = editor.element.querySelector('h2')!
    setCollapsedSelection(heading, 0)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<p><br></p>')
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

    const nextHeading = editor.element.querySelector('h2')
    const paragraph = editor.element.querySelector('p')
    expect(nextHeading?.textContent).toBe('Hello')
    expect(paragraph?.textContent?.trim()).toBe('world')
    wrapper.unmount()
  })

  it('moves out of inline code at the editor root on Enter', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<code>code</code>'
    const text = editor.element.querySelector('code')!.firstChild!
    setCollapsedSelection(text, 2)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<p><code>code</code></p><p><br></p>')
    wrapper.unmount()
  })

  it('inserts a newline inside a preformatted code block', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<pre><code>const x = 1;</code></pre>'
    const text = editor.element.querySelector('code')!.firstChild!
    setCollapsedSelection(text, 5)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.querySelector('pre')?.textContent).toBe('const\n x = 1;')
    wrapper.unmount()
  })
})
