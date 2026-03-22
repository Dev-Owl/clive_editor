import { afterEach, describe, expect, it } from 'vitest'
import {
  findClosestCell,
  getAdjacentCell,
  getSelectedHtml,
  getSelectedText,
  handleCrossCellDelete,
  insertHtmlAtCursor,
  insertTextareaSyntax,
  isInsideTag,
  isSelectionCrossCell,
  restoreSelection,
  saveSelection,
  wrapBlock,
  wrapSelection,
} from '@/utils/selection'

function setSelection(startNode: Node, startOffset: number, endNode = startNode, endOffset = startOffset) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function createEditor(html: string): HTMLDivElement {
  const editor = document.createElement('div')
  editor.contentEditable = 'true'
  editor.innerHTML = html
  document.body.appendChild(editor)
  return editor
}

describe('selection utils', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('saves and restores the current selection', () => {
    const editor = createEditor('<p>Hello world</p>')
    const text = editor.querySelector('p')!.firstChild!

    setSelection(text, 1, text, 5)
    const saved = saveSelection()

    window.getSelection()?.removeAllRanges()
    expect(getSelectedText()).toBe('')

    restoreSelection(saved!)
    expect(getSelectedText()).toBe('ello')
  })

  it('returns selected html and text', () => {
    const editor = createEditor('<p>Hello <strong>world</strong></p>')
    const paragraph = editor.querySelector('p')!

    setSelection(paragraph.firstChild!, 3, paragraph.querySelector('strong')!.firstChild!, 3)

    expect(getSelectedText()).toBe('lo wor')
    expect(getSelectedHtml()).toContain('lo ')
    expect(getSelectedHtml()).toContain('<strong>wor</strong>')
  })

  it('wraps a text selection and toggles it off when repeated', () => {
    const editor = createEditor('<p>Hello world</p>')
    const text = editor.querySelector('p')!.firstChild!

    setSelection(text, 0, text, 5)
    wrapSelection('strong')
    expect(editor.innerHTML).toBe('<p><strong>Hello</strong> world</p>')

    const strongText = editor.querySelector('strong')!.firstChild!
    setSelection(strongText, 0, strongText, 5)
    wrapSelection('strong')
    expect(editor.innerHTML).toBe('<p>Hello world</p>')
  })

  it('inserts placeholders for collapsed inline wraps and exits inline formatting on repeated call', () => {
    const editor = createEditor('<p>Hello</p>')
    const text = editor.querySelector('p')!.firstChild!

    setSelection(text, 5)
    wrapSelection('code')
    expect(editor.querySelector('code')?.textContent).toBe('\u00A0')

    const codeText = editor.querySelector('code')!.firstChild!
    setSelection(codeText, 1)
    wrapSelection('code')

    expect(editor.querySelector('code')).toBeTruthy()
    expect(editor.textContent).toContain('\u200B')
  })

  it('does not wrap cross-cell table selections', () => {
    const editor = createEditor('<table><tbody><tr><td>One</td><td>Two</td></tr></tbody></table>')
    const cells = editor.querySelectorAll('td')

    setSelection(cells[0].firstChild!, 0, cells[1].firstChild!, 3)
    expect(isSelectionCrossCell()).toBe(true)

    wrapSelection('strong')
    expect(editor.innerHTML).toBe('<table><tbody><tr><td>One</td><td>Two</td></tr></tbody></table>')
  })

  it('wraps bare editor text in a block element and toggles block wrappers', () => {
    const editor = createEditor('Plain text')
    const text = editor.firstChild!

    setSelection(text, 5)
    wrapBlock('blockquote', editor)
    expect(editor.innerHTML).toBe('<blockquote><p>Plain text</p></blockquote>')

    const paragraphText = editor.querySelector('p')!.firstChild!
    setSelection(paragraphText, 2)
    wrapBlock('blockquote', editor)
    expect(editor.innerHTML).toBe('<p>Plain text</p>')
  })

  it('does not apply block wrapping inside a table cell', () => {
    const editor = createEditor('<table><tbody><tr><td>Cell</td></tr></tbody></table>')
    const cellText = editor.querySelector('td')!.firstChild!

    setSelection(cellText, 2)
    wrapBlock('blockquote', editor)

    expect(editor.innerHTML).toBe('<table><tbody><tr><td>Cell</td></tr></tbody></table>')
  })

  it('inserts html at the cursor and moves the caret after the inserted content', () => {
    const editor = createEditor('<p>Hello world</p>')
    const text = editor.querySelector('p')!.firstChild!

    setSelection(text, 5)
    insertHtmlAtCursor('<strong> brave</strong>')

    expect(editor.innerHTML).toBe('<p>Hello<strong> brave</strong> world</p>')

    const selection = window.getSelection()
    expect(selection?.anchorNode).toBe(editor.querySelector('p'))
    expect(selection?.anchorOffset).toBe(2)
  })

  it('inserts textarea syntax and keeps the selection inside the markers', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'Hello world'
    document.body.appendChild(textarea)
    textarea.selectionStart = 6
    textarea.selectionEnd = 11

    const nextValue = insertTextareaSyntax(textarea, '**', '**')

    expect(nextValue).toBe('Hello **world**')
    expect(textarea.value).toBe('Hello **world**')
    expect(textarea.selectionStart).toBe(8)
    expect(textarea.selectionEnd).toBe(13)
  })

  it('detects when the current selection is inside a tag', () => {
    const editor = createEditor('<p>Hello <strong>world</strong></p>')
    const strongText = editor.querySelector('strong')!.firstChild!

    setSelection(strongText, 1, strongText, 4)

    expect(isInsideTag('strong')).toBe(true)
    expect(isInsideTag('em')).toBe(false)
  })

  it('resolves cells from structural table nodes and adjacent cell lookup', () => {
    const editor = createEditor('<table><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>')
    const thead = editor.querySelector('thead')!
    const headerRow = editor.querySelector('thead tr')!
    const secondBodyCell = editor.querySelectorAll('td')[1]

    expect(findClosestCell(thead, 0)?.textContent).toBe('H1')
    expect(findClosestCell(headerRow, 1)?.textContent).toBe('H2')
    expect(findClosestCell(headerRow, 2)?.textContent).toBe('H2')
    expect(getAdjacentCell(secondBodyCell, 'prev')?.textContent).toBe('A')
    expect(getAdjacentCell(secondBodyCell, 'next')).toBeNull()
  })

  it('clears selected cross-cell contents and collapses the selection back into the anchor cell', () => {
    const editor = createEditor('<table><tbody><tr><td>One</td><td>Two</td></tr></tbody></table>')
    const cells = editor.querySelectorAll('td')

    setSelection(cells[0].firstChild!, 0, cells[1].firstChild!, 3)
    expect(isSelectionCrossCell()).toBe(true)

    handleCrossCellDelete()

    expect(cells[0].innerHTML).toBe('')
    expect(cells[1].innerHTML).toBe('')
    expect(window.getSelection()?.anchorNode).toBe(cells[0])
    expect(window.getSelection()?.anchorOffset).toBe(0)
  })
})
