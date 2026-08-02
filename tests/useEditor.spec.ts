import { ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { useEditor } from '@/composables/useEditor'

function createEditor(html: string) {
  const el = document.createElement('div')
  el.contentEditable = 'true'
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

function setCollapsedSelection(node: Node, offset = 0) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe('useEditor list behavior', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('indents a list item when a previous sibling exists', () => {
    const el = createEditor('<ul><li>One</li><li>Two</li></ul>')
    const editor = useEditor(ref(el))
    const secondText = el.querySelectorAll('li')[1].firstChild!
    setCollapsedSelection(secondText, 0)

    editor.indentList()

    expect(el.innerHTML).toBe('<ul><li>One<ul><li>Two</li></ul></li></ul>')
  })

  it('does not indent the first list item', () => {
    const el = createEditor('<ul><li>One</li><li>Two</li></ul>')
    const editor = useEditor(ref(el))
    const firstText = el.querySelector('li')!.firstChild!
    setCollapsedSelection(firstText, 0)

    editor.indentList()

    expect(el.innerHTML).toBe('<ul><li>One</li><li>Two</li></ul>')
  })

  it('outdents a nested list item by one level', () => {
    const el = createEditor('<ul><li>Parent<ul><li>Child</li></ul></li></ul>')
    const editor = useEditor(ref(el))
    const childText = el.querySelector('ul ul li')!.firstChild!
    setCollapsedSelection(childText, 0)

    editor.outdentList()

    expect(el.innerHTML).toBe('<ul><li>Parent</li><li>Child</li></ul>')
  })

  it('preserves following nested siblings when outdenting', () => {
    const el = createEditor('<ul><li>Parent<ul><li>Child</li><li>Sibling</li></ul></li></ul>')
    const editor = useEditor(ref(el))
    const childText = el.querySelector('ul ul li')!.firstChild!
    setCollapsedSelection(childText, 0)

    editor.outdentList()

    expect(el.innerHTML).toBe('<ul><li>Parent</li><li>Child<ul><li>Sibling</li></ul></li></ul>')
  })

  it('merges following siblings into the sub-list an outdented item already has', () => {
    const el = createEditor(
      '<ul><li>Parent<ul><li>Child<ul><li>Grandchild</li></ul></li><li>Sibling</li></ul></li></ul>',
    )
    const editor = useEditor(ref(el))
    const childText = el.querySelector('ul ul li')!.firstChild!
    setCollapsedSelection(childText, 0)

    editor.outdentList()

    expect(el.innerHTML).toBe(
      '<ul><li>Parent</li><li>Child<ul><li>Grandchild</li><li>Sibling</li></ul></li></ul>',
    )
    expect(el.querySelectorAll('li > ul')).toHaveLength(1)
  })

  it('unwraps nested items too when switching a list off', () => {
    const el = createEditor('<ul><li>Parent<ul><li>Child</li></ul></li><li>Second</li></ul>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('li')!.firstChild!, 0)

    editor.bulletList()

    expect(el.querySelector('ul')).toBeNull()
    expect(Array.from(el.querySelectorAll('p')).map((p) => p.textContent)).toEqual([
      'Parent',
      'Child',
      'Second',
    ])
  })

  it('wraps selected table-cell content in a bullet list', () => {
    const el = createEditor('<table><tbody><tr><td>Cell</td></tr></tbody></table>')
    const editor = useEditor(ref(el))
    const cellText = el.querySelector('td')!.firstChild!
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(cellText, 0)
    range.setEnd(cellText, 4)
    selection?.removeAllRanges()
    selection?.addRange(range)

    editor.bulletList()

    expect(el.querySelector('td')?.innerHTML).toBe('<ul><li>Cell</li></ul>')
  })

  it('strips existing list markers when turning selected text into a bullet list', () => {
    const el = createEditor('<p>- Progress</p>')
    const editor = useEditor(ref(el))
    const text = el.querySelector('p')!.firstChild!
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, text.textContent?.length ?? 0)
    selection?.removeAllRanges()
    selection?.addRange(range)

    editor.bulletList()

    expect(el.innerHTML).toBe('<ul><li>Progress</li></ul>')
  })

  it('does not report inline code as active inside a code block', () => {
    const el = createEditor('<pre><code>const x = 1;</code></pre>')
    const editor = useEditor(ref(el))
    const codeText = el.querySelector('code')!.firstChild!
    setCollapsedSelection(codeText, 3)

    editor.refreshActiveState()

    expect(editor.isActive('pre')).toBe(true)
    expect(editor.isActive('code')).toBe(false)
  })

  it('does not apply inline code formatting inside a code block', () => {
    const el = createEditor('<pre><code>const x = 1;</code></pre>')
    const editor = useEditor(ref(el))
    const codeText = el.querySelector('code')!.firstChild!
    setCollapsedSelection(codeText, 3)

    editor.codeInline()

    expect(el.innerHTML).toBe('<pre><code>const x = 1;</code></pre>')
  })
})
