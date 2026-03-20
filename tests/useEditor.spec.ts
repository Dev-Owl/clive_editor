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
})
