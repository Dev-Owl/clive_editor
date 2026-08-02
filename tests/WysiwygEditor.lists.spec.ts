import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WysiwygEditor from '@/components/WysiwygEditor.vue'
import { setCollapsedSelection, triggerPaste } from './helpers/wysiwyg'

/**
 * Removing a bullet whose text was just deleted is what used to corrupt lists:
 * the browser drops the item's placeholder and leaves the sub-list inside a
 * text-less item, which markdown writes as `-   -   text`.
 */
describe('WysiwygEditor list item removal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  function mountEditor(html: string) {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: { modelValue: '' },
    })
    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = html
    return { wrapper, editor }
  }

  it('gives the sub-list back to the item above when the emptied bullet is removed', async () => {
    const { wrapper, editor } = mountEditor(
      '<ul><li>Draak import</li><li><br><ul><li>Re-download</li><li>Re-run</li></ul></li></ul>',
    )
    setCollapsedSelection(editor.element.querySelectorAll('li')[1], 0)

    await editor.trigger('keydown', { key: 'Backspace' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe(
      '<ul><li>Draak import<ul><li>Re-download</li><li>Re-run</li></ul></li></ul>',
    )

    const updates = wrapper.emitted('update:modelValue')
    expect(updates?.[updates.length - 1]?.[0]).not.toMatch(/-\s+-\s/)
    wrapper.unmount()
  })

  it('merges into the sub-list the item above already has', async () => {
    const { wrapper, editor } = mountEditor(
      '<ul><li>Parent<ul><li>First</li></ul></li><li><br><ul><li>Second</li></ul></li></ul>',
    )
    setCollapsedSelection(editor.element.querySelectorAll('li')[2], 0)

    await editor.trigger('keydown', { key: 'Backspace' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe(
      '<ul><li>Parent<ul><li>First</li><li>Second</li></ul></li></ul>',
    )
    wrapper.unmount()
  })

  it('removes an emptied first sub-item and puts the caret in its parent', async () => {
    const { wrapper, editor } = mountEditor(
      '<ul><li>Parent<ul><li><br></li><li>Child</li></ul></li></ul>',
    )
    setCollapsedSelection(editor.element.querySelector('ul ul li')!, 0)

    await editor.trigger('keydown', { key: 'Backspace' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<ul><li>Parent<ul><li>Child</li></ul></li></ul>')
    expect(window.getSelection()?.anchorNode?.textContent).toBe('Parent')
    wrapper.unmount()
  })

  it('outdents instead of deleting when the emptied first sub-item has children', async () => {
    const { wrapper, editor } = mountEditor(
      '<ul><li>Parent<ul><li><br><ul><li>Deep</li></ul></li></ul></li></ul>',
    )
    setCollapsedSelection(editor.element.querySelector('ul ul li')!, 0)

    await editor.trigger('keydown', { key: 'Backspace' })
    vi.runAllTimers()

    expect(wrapper.emitted('action')?.map(([action]) => action)).toEqual(['outdentList'])
    wrapper.unmount()
  })

  it('leaves the list when the emptied bullet is the first top-level item', async () => {
    const { wrapper, editor } = mountEditor('<ul><li><br><ul><li>Child</li></ul></li></ul>')
    setCollapsedSelection(editor.element.querySelector('li')!, 0)

    await editor.trigger('keydown', { key: 'Backspace' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<p><br></p><ul><li>Child</li></ul>')
    wrapper.unmount()
  })

  it('keeps the browser default for a bullet that still has text', async () => {
    const { wrapper, editor } = mountEditor('<ul><li>One</li><li>Two</li></ul>')
    setCollapsedSelection(editor.element.querySelectorAll('li')[1].firstChild!, 0)

    await editor.trigger('keydown', { key: 'Backspace' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<ul><li>One</li><li>Two</li></ul>')
    wrapper.unmount()
  })

  it('does not repair the item the caret sits in', async () => {
    const { wrapper, editor } = mountEditor(
      '<ul><li>Parent</li><li><br><ul><li>Child</li></ul></li></ul>',
    )
    const emptied = editor.element.querySelectorAll('li')[1]
    setCollapsedSelection(emptied, 0)

    await editor.trigger('input')
    vi.runAllTimers()

    expect(editor.element.querySelectorAll('li')).toHaveLength(3)
    wrapper.unmount()
  })

  it('serializes an emptied bullet without loosening the list', async () => {
    const { wrapper, editor } = mountEditor(
      '<ul><li>Parent<ul><li><br></li><li>Re-download</li></ul></li></ul>',
    )
    setCollapsedSelection(editor.element.querySelector('ul ul li')!, 0)

    await editor.trigger('input')
    vi.runAllTimers()

    const updates = wrapper.emitted('update:modelValue')
    const markdown = updates?.[updates.length - 1]?.[0] as string
    expect(markdown.split('\n').some((line) => line.trim() === '')).toBe(false)
    expect(markdown).toContain('    -   Re-download')
    wrapper.unmount()
  })
})

/**
 * Pasting a list used to flatten it: every `<li>` at any depth was inserted as
 * a sibling, and indentation in plain-text markdown was dropped entirely.
 */
describe('WysiwygEditor list paste', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  function mountEditor(html: string) {
    const wrapper = mount(WysiwygEditor, {
      attachTo: document.body,
      props: { modelValue: '' },
    })
    const editor = wrapper.get('.ce-wysiwyg')
    editor.element.innerHTML = html
    return { wrapper, editor }
  }

  function lastMarkdown(wrapper: ReturnType<typeof mountEditor>['wrapper']) {
    const updates = wrapper.emitted('update:modelValue')
    return updates?.[updates.length - 1]?.[0] as string
  }

  it('keeps pasted sub-items nested when merging into a list', async () => {
    const { wrapper, editor } = mountEditor('<ul><li>Start</li></ul>')
    setCollapsedSelection(editor.element.querySelector('li')!.firstChild!, 5)

    await triggerPaste(wrapper, {
      html: '<ul><li>Two<ul><li>Two.a</li><li>Two.b</li></ul></li><li>Three</li></ul>',
      text: 'Two\nTwo.a\nTwo.b\nThree',
    })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe(
      '<ul><li>Start</li><li>Two<ul><li>Two.a</li><li>Two.b</li></ul></li><li>Three</li></ul>',
    )
    expect(lastMarkdown(wrapper)).toContain('    -   Two.a')
    wrapper.unmount()
  })

  it('turns indentation in pasted markdown text into nested items', async () => {
    const { wrapper, editor } = mountEditor('<ul><li>Start</li></ul>')
    setCollapsedSelection(editor.element.querySelector('li')!.firstChild!, 5)

    await triggerPaste(wrapper, { text: '- Two\n    - Two.a\n    - Two.b\n- Three' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe(
      '<ul><li>Start</li><li>Two<ul><li>Two.a</li><li>Two.b</li></ul></li><li>Three</li></ul>',
    )
    wrapper.unmount()
  })

  it('reads tab indentation and deeper levels', async () => {
    const { wrapper, editor } = mountEditor('<ul><li>Start</li></ul>')
    setCollapsedSelection(editor.element.querySelector('li')!.firstChild!, 5)

    await triggerPaste(wrapper, { text: '* One\n\t* One.a\n\t\t* One.a.i\n* Two' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe(
      '<ul><li>Start</li>'
      + '<li>One<ul><li>One.a<ul><li>One.a.i</li></ul></li></ul></li>'
      + '<li>Two</li></ul>',
    )
    wrapper.unmount()
  })

  it('builds a real list when markdown list text is pasted into an empty document', async () => {
    const { wrapper, editor } = mountEditor('<p><br></p>')
    setCollapsedSelection(editor.element.querySelector('p')!, 0)

    await triggerPaste(wrapper, { text: '- One\n    - One.a\n- Two' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe(
      '<ul><li>One<ul><li>One.a</li></ul></li><li>Two</li></ul>',
    )
    expect(lastMarkdown(wrapper)).not.toContain('\\-')
    wrapper.unmount()
  })

  it('builds an ordered list from pasted numbered markdown text', async () => {
    const { wrapper, editor } = mountEditor('<p><br></p>')
    setCollapsedSelection(editor.element.querySelector('p')!, 0)

    await triggerPaste(wrapper, { text: '1. First\n2. Second' })
    vi.runAllTimers()

    expect(editor.element.innerHTML).toBe('<ol><li>First</li><li>Second</li></ol>')
    wrapper.unmount()
  })

  it('leaves pasted list text as text when the paragraph already has content', async () => {
    const { wrapper, editor } = mountEditor('<p>Existing</p>')
    setCollapsedSelection(editor.element.querySelector('p')!.firstChild!, 8)

    await triggerPaste(wrapper, { text: '- One\n- Two' })
    vi.runAllTimers()

    expect(editor.element.querySelector('ul')).toBeNull()
    expect(editor.element.textContent).toContain('- One')
    wrapper.unmount()
  })

  it('leaves pasted list text as text inside a code block', async () => {
    const { wrapper, editor } = mountEditor('<pre><code>code</code></pre>')
    setCollapsedSelection(editor.element.querySelector('code')!.firstChild!, 4)

    await triggerPaste(wrapper, { text: '- One\n- Two' })
    vi.runAllTimers()

    expect(editor.element.querySelector('ul')).toBeNull()
    wrapper.unmount()
  })
})
