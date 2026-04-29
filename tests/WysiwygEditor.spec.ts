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
