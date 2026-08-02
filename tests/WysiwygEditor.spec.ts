import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WysiwygEditor from '@/components/WysiwygEditor.vue'
import { setCollapsedSelection, triggerPaste } from './helpers/wysiwyg'

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

  it('creates a bullet list from the input fallback when space arrives after a fast asterisk', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.textContent = '* '
    setCollapsedSelection(editor.element.firstChild!, 2)

    await editor.trigger('input')
    vi.runAllTimers()

    expect(wrapper.find('.ce-wysiwyg ul > li').exists()).toBe(true)
    wrapper.unmount()
  })

  it('flushes pending markdown on blur so the last keystrokes are not lost', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.textContent = 'Hello world'
    setCollapsedSelection(editor.element.firstChild!, 11)

    // Fire input but DO NOT run the debounce timer — the edit is still pending.
    await editor.trigger('input')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    // Blurring must flush the pending markdown immediately.
    await editor.trigger('blur')

    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toBe('Hello world')
    wrapper.unmount()
  })

  it('flushes pending markdown before unmount so no input is dropped', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.textContent = 'Unsaved text'
    setCollapsedSelection(editor.element.firstChild!, 12)

    await editor.trigger('input')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    // Unmount within the debounce window — the pending edit must still emit.
    wrapper.unmount()

    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toBe('Unsaved text')
  })

  it('emits markdown only once per edit (single serialize path)', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.textContent = 'abc'
    setCollapsedSelection(editor.element.firstChild!, 3)

    await editor.trigger('input')
    vi.runAllTimers()

    expect(wrapper.emitted('update:modelValue')?.length).toBe(1)
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

  it('moves above the first code block when pressing ArrowUp on its first line', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<pre><code>const x = 1;\nconst y = 2;</code></pre>'
    const text = editor.element.querySelector('code')!.firstChild!
    setCollapsedSelection(text, 5)

    await editor.trigger('keydown', { key: 'ArrowUp' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<p><br></p><pre><code>const x = 1;\nconst y = 2;</code></pre>')
    expect(window.getSelection()?.anchorNode).toBe(editor.element.querySelector('p'))
    expect(window.getSelection()?.anchorOffset).toBe(0)
    wrapper.unmount()
  })

  it('removes an empty inline code wrapper after the editor is cleared', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<p><code><br></code></p>'
    const code = editor.element.querySelector('code')!
    setCollapsedSelection(code, 0)

    await editor.trigger('input')
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<p><br></p>')
    expect(window.getSelection()?.anchorNode).toBe(editor.element.querySelector('p'))
    expect(window.getSelection()?.anchorOffset).toBe(0)
    wrapper.unmount()
  })

  it('unwraps browser-generated inline code styling artifacts outside pre blocks', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<p><font color="#e11d48" face="SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace"><span style="font-size: 14.4px; background-color: rgb(243, 244, 246);">dsadas</span></font></p>'

    await editor.trigger('input')
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<p>dsadas</p>')
    wrapper.unmount()
  })

  it('does not route language input keystrokes into the code block', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '',
      },
    })

    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = '<pre><div class="ce-code-lang" contenteditable="false" data-lang="">plain text</div><code>const x = 1;</code></pre>'

    const codeText = editor.element.querySelector('code')!.firstChild!
    setCollapsedSelection(codeText, 2)

    const label = editor.element.querySelector('.ce-code-lang') as HTMLElement
    label.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const input = editor.element.querySelector('.ce-code-lang-input') as HTMLInputElement | null
    expect(input).not.toBeNull()

    input!.value = 'j'
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    input!.dispatchEvent(new KeyboardEvent('keyup', { key: 'j', bubbles: true }))
    vi.runAllTimers()

    expect(editor.element.querySelector('code')?.textContent).toBe('const x = 1;')
    expect(input!.value).toBe('j')
    expect(document.activeElement).toBe(input)
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

  it('merges pasted list items into the current list', async () => {
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

  it('merges pasted markdown-style list text into the current list', async () => {
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
      text: '- Two\n- Three',
    })
    vi.runAllTimers()

    const items = Array.from(editor.element.querySelectorAll('li')).map((item) => item.textContent?.trim())
    expect(items).toEqual(['Start', 'Two', 'Three'])
    expect(editor.element.querySelectorAll('ul')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows image resize controls and applies preset widths without changing aspect ratio', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '![Preview](https://example.com/image.png)',
      },
    })

    const image = wrapper.get('.ce-wysiwyg img')
    await image.trigger('click')

    expect(wrapper.find('.ce-image-controls').exists()).toBe(true)

    await wrapper.get('button[title="Resize image to 50%"]').trigger('click')
    vi.runAllTimers()

    expect(image.attributes('data-ce-width')).toBe('50%')
    expect((image.element as HTMLImageElement).style.width).toBe('50%')
    expect((image.element as HTMLImageElement).style.height).toBe('auto')
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toBe('![Preview](https://example.com/image.png "ce-width:50%")')
    wrapper.unmount()
  })

  it('focuses the custom image width input so the value can be typed immediately', async () => {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: {
        modelValue: '![Preview](https://example.com/image.png)',
      },
    })

    await wrapper.get('.ce-wysiwyg img').trigger('click')
    await wrapper.get('button[title="Custom image size"]').trigger('click')
    await wrapper.vm.$nextTick()

    const input = wrapper.get('.ce-image-controls__input')
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    input.element.dispatchEvent(mouseDown)

    expect(mouseDown.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(input.element)

    await input.setValue('65')
    await wrapper.get('button[title="Apply custom image size"]').trigger('submit')
    vi.runAllTimers()

    const image = wrapper.get('.ce-wysiwyg img')
    expect(image.attributes('data-ce-width')).toBe('65%')
    expect((image.element as HTMLImageElement).style.width).toBe('65%')
    wrapper.unmount()
  })
})
