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

  it('splits to a new paragraph when pressing Enter inside inline code in a paragraph', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<p><code>code</code></p>'
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

  it('appends a newline inside code when Enter is pressed at the end of a single-line code block', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.textContent = 'const x = 1;'
    pre.appendChild(code)
    editor.element.replaceChildren(pre)
    setCollapsedSelection(pre, pre.childNodes.length)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<pre><code>const x = 1;\n\u200B</code></pre>')
    expect(window.getSelection()?.anchorNode?.textContent).toBe('\u200B')
    expect(window.getSelection()?.anchorOffset).toBe(0)
    wrapper.unmount()
  })

  it('appends a newline inside code when Enter is pressed at the end of a multiline code block', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.textContent = 'const x = 1;\nconst y = 2;'
    pre.appendChild(code)
    editor.element.replaceChildren(pre)
    setCollapsedSelection(pre, pre.childNodes.length)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<pre><code>const x = 1;\nconst y = 2;\n\u200B</code></pre>')
    expect(window.getSelection()?.anchorNode?.textContent).toBe('\u200B')
    expect(window.getSelection()?.anchorOffset).toBe(0)
    wrapper.unmount()
  })

  it('adds a newline on the first Enter for a code block rendered from markdown', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '```js\nconst x = 1;\n```',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    const code = editor.element.querySelector('pre code')!
    const text = code.lastChild!
    setCollapsedSelection(text, text.textContent?.length ?? 0)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(code.textContent?.replace(/\u200B/g, '')).toBe('const x = 1;\n')
    expect(window.getSelection()?.anchorNode?.textContent).toBe('\u200B')
    expect(window.getSelection()?.anchorOffset).toBe(0)
    wrapper.unmount()
  })

  it('selects only the current multiline code block on Ctrl+A', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<p>Before</p><pre><code>const x = 1;\nconst y = 2;</code></pre><p>After</p>'
    const codeText = editor.element.querySelector('pre code')!.firstChild!
    setCollapsedSelection(codeText, 3)

    await editor.trigger('keydown', { key: 'a', ctrlKey: true })

    const selection = window.getSelection()
    expect(selection?.toString()).toBe('const x = 1;\nconst y = 2;')
    expect(editor.element.querySelector('pre code')?.contains(selection?.anchorNode ?? null)).toBe(true)
    expect(editor.element.textContent).toContain('Before')
    expect(editor.element.textContent).toContain('After')
    wrapper.unmount()
  })

  it('replaces the selected multiline code block contents when typing after Ctrl+A', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<pre><div class="ce-code-lang" contenteditable="false" data-lang="">plain text</div><code>line 1\nline 2</code></pre>'
    const codeText = editor.element.querySelector('pre code')!.firstChild!
    setCollapsedSelection(codeText, 2)

    await editor.trigger('keydown', { key: 'a', ctrlKey: true })
    await editor.trigger('keydown', { key: 'x' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<pre><div class="ce-code-lang" contenteditable="false" data-lang="">plain text</div><code>x</code></pre>')

    const updates = wrapper.emitted('update:modelValue')
    const last = updates?.[updates.length - 1]
    expect(last?.[0]).toContain('```\nx\n```')
    wrapper.unmount()
  })

  it('starts the next list item without carrying inline formatting forward', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<ul><li><del>Done</del></li></ul>'
    const text = editor.element.querySelector('del')!.firstChild!
    setCollapsedSelection(text, text.textContent?.length ?? 0)

    await editor.trigger('keydown', { key: 'Enter' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<ul><li><del>Done</del></li><li><br></li></ul>')
    expect(editor.element.querySelectorAll('li')[1].querySelector('del')).toBeNull()
    wrapper.unmount()
  })
})
