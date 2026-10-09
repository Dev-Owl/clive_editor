import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditor } from '@/composables/useEditor'

/* ------------------------------------------------------------------ */
/*  Helpers (mirrors tests/useEditor.spec.ts)                          */
/* ------------------------------------------------------------------ */

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

function selectRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** Select the full text content of an element's first text node. */
function selectTextOf(el: Element) {
  const text = el.firstChild!
  selectRange(text, 0, text, text.textContent?.length ?? 0)
}

afterEach(() => {
  document.body.innerHTML = ''
  window.getSelection()?.removeAllRanges()
})

/* ------------------------------------------------------------------ */
/*  Inline formatting: bold / italic / strikethrough / codeInline      */
/* ------------------------------------------------------------------ */

describe('useEditor inline formatting', () => {
  it('wraps a selection in <strong> for bold', () => {
    const el = createEditor('<p>hello</p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('p')!)

    editor.bold()

    expect(el.querySelector('strong')?.textContent).toBe('hello')
    expect(editor.isActive('strong')).toBe(true)
  })

  it('toggles bold off when the selection is already bold', () => {
    const el = createEditor('<p><strong>hello</strong></p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('strong')!)

    editor.bold()

    expect(el.querySelector('strong')).toBeNull()
    expect(el.textContent).toBe('hello')
  })

  it('wraps a selection in <em> for italic', () => {
    const el = createEditor('<p>hello</p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('p')!)

    editor.italic()

    expect(el.querySelector('em')?.textContent).toBe('hello')
  })

  it('wraps a selection in <del> for strikethrough', () => {
    const el = createEditor('<p>hello</p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('p')!)

    editor.strikethrough()

    expect(el.querySelector('del, s')?.textContent).toBe('hello')
  })

  it('wraps a selection in <code> for inline code', () => {
    const el = createEditor('<p>hello</p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('p')!)

    editor.codeInline()

    expect(el.querySelector('code')?.textContent).toBe('hello')
  })

  it('does not apply bold across table cells', () => {
    const el = createEditor('<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>')
    const editor = useEditor(ref(el))
    const before = el.innerHTML
    const cells = el.querySelectorAll('td')
    selectRange(cells[0].firstChild!, 0, cells[1].firstChild!, 1)

    editor.bold()

    expect(el.innerHTML).toBe(before)
    expect(el.querySelector('strong')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/*  Headings                                                           */
/* ------------------------------------------------------------------ */

describe('useEditor heading', () => {
  it('converts a paragraph to a heading, preserving content', () => {
    const el = createEditor('<p>Title</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    editor.heading(2)

    expect(el.querySelector('h2')?.textContent).toBe('Title')
    expect(el.querySelector('p')).toBeNull()
  })

  it('toggles a heading back to a paragraph at the same level', () => {
    const el = createEditor('<h2>Title</h2>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('h2')!.firstChild!, 1)

    editor.heading(2)

    expect(el.querySelector('h2')).toBeNull()
    expect(el.querySelector('p')?.textContent).toBe('Title')
  })

  it('converts between heading levels', () => {
    const el = createEditor('<h1>Title</h1>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('h1')!.firstChild!, 1)

    editor.heading(3)

    expect(el.querySelector('h1')).toBeNull()
    expect(el.querySelector('h3')?.textContent).toBe('Title')
  })

  it('inserts a default-text heading when the block is empty', () => {
    const el = createEditor('<p><br></p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!, 0)

    editor.heading(1)

    expect(el.querySelector('h1')?.textContent).toBe('Heading')
  })

  it('does not apply headings inside table cells', () => {
    const el = createEditor('<table><tbody><tr><td>Cell</td></tr></tbody></table>')
    const editor = useEditor(ref(el))
    const before = el.innerHTML
    setCollapsedSelection(el.querySelector('td')!.firstChild!, 1)

    editor.heading(1)

    expect(el.innerHTML).toBe(before)
  })
})

/* ------------------------------------------------------------------ */
/*  Blockquote                                                         */
/* ------------------------------------------------------------------ */

describe('useEditor blockquote', () => {
  it('wraps a paragraph in a blockquote', () => {
    const el = createEditor('<p>quote me</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    editor.blockquote()

    const bq = el.querySelector('blockquote')
    expect(bq).not.toBeNull()
    expect(bq?.textContent).toBe('quote me')
  })

  it('toggles a blockquote off', () => {
    const el = createEditor('<blockquote><p>quote me</p></blockquote>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    editor.blockquote()

    expect(el.querySelector('blockquote')).toBeNull()
    expect(el.textContent).toBe('quote me')
  })
})

/* ------------------------------------------------------------------ */
/*  Code block                                                         */
/* ------------------------------------------------------------------ */

describe('useEditor codeBlock', () => {
  it('inserts a code block wrapping the selected text', () => {
    const el = createEditor('<p>snippet</p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('p')!)

    editor.codeBlock()

    const pre = el.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.querySelector('code')?.textContent).toBe('snippet')
  })

  it('adds a language class when a language is provided', () => {
    const el = createEditor('<p>x = 1</p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('p')!)

    editor.codeBlock('python')

    const code = el.querySelector('pre code')
    expect(code?.className).toContain('language-python')
    expect(el.querySelector('.ce-code-lang')?.getAttribute('data-lang')).toBe('python')
  })

  it('unwraps a code block back to a paragraph', () => {
    const el = createEditor('<pre><code>const x = 1;</code></pre>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('code')!.firstChild!, 3)

    editor.codeBlock()

    expect(el.querySelector('pre')).toBeNull()
    expect(el.querySelector('p')?.textContent).toBe('const x = 1;')
  })

  it('escapes HTML in the code text', () => {
    const el = createEditor('<p>&lt;script&gt;</p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('p')!)

    editor.codeBlock()

    // The rendered code must contain the literal text, not an actual element.
    expect(el.querySelector('pre code')?.textContent).toBe('<script>')
    expect(el.querySelector('pre code script')).toBeNull()
  })

  it('does not apply a code block inside table cells', () => {
    const el = createEditor('<table><tbody><tr><td>Cell</td></tr></tbody></table>')
    const editor = useEditor(ref(el))
    const before = el.innerHTML
    setCollapsedSelection(el.querySelector('td')!.firstChild!, 1)

    editor.codeBlock()

    expect(el.innerHTML).toBe(before)
  })
})

/* ------------------------------------------------------------------ */
/*  Links & images                                                     */
/* ------------------------------------------------------------------ */

describe('useEditor link', () => {
  it('inserts a link with explicit url and text', () => {
    const el = createEditor('<p>x</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    editor.link('https://example.com', 'Example')

    const a = el.querySelector('a')
    expect(a?.getAttribute('href')).toBe('https://example.com')
    expect(a?.textContent).toBe('Example')
  })

  it('keeps special characters in the url and label as plain values', () => {
    const el = createEditor('<p>x</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    const url = 'https://example.com/?a=1&b=<2>&c="3"&d=\'4\''
    editor.link(url, '<b>not bold</b>')

    const a = el.querySelector('a')
    expect(a?.getAttribute('href')).toBe(url)
    expect(a?.textContent).toBe('<b>not bold</b>')
    expect(a?.querySelector('b')).toBeNull()
    expect(a?.attributes).toHaveLength(1)
  })

  it('uses the selected text as the link label when text is omitted', () => {
    const el = createEditor('<p>label</p>')
    const editor = useEditor(ref(el))
    selectTextOf(el.querySelector('p')!)

    editor.link('https://example.com')

    const a = el.querySelector('a')
    expect(a?.getAttribute('href')).toBe('https://example.com')
    expect(a?.textContent).toBe('label')
  })

  it('does nothing when the prompt is cancelled', () => {
    const el = createEditor('<p>x</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)
    const promptSpy = vi.stubGlobal('prompt', () => null)

    editor.link()

    expect(el.querySelector('a')).toBeNull()
    void promptSpy
    vi.unstubAllGlobals()
  })
})

describe('useEditor image', () => {
  it('inserts an image with explicit src and alt', () => {
    const el = createEditor('<p>x</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    editor.image('https://example.com/a.png', 'Alt text')

    const img = el.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png')
    expect(img?.getAttribute('alt')).toBe('Alt text')
  })

  it('defaults the alt text to "image"', () => {
    const el = createEditor('<p>x</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    editor.image('https://example.com/a.png')

    expect(el.querySelector('img')?.getAttribute('alt')).toBe('image')
  })
})

/* ------------------------------------------------------------------ */
/*  Horizontal rule & table                                            */
/* ------------------------------------------------------------------ */

describe('useEditor horizontalRule and table', () => {
  it('inserts a horizontal rule', () => {
    const el = createEditor('<p>x</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    editor.horizontalRule()

    expect(el.querySelector('hr')).not.toBeNull()
  })

  it('inserts a table with the requested dimensions', () => {
    const el = createEditor('<p>x</p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!.firstChild!, 1)

    editor.table(3, 2)

    const table = el.querySelector('table')
    expect(table).not.toBeNull()
    expect(table?.querySelectorAll('thead th')).toHaveLength(2)
    // rows-1 body rows are generated (header counts as the first row)
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(table?.querySelectorAll('tbody tr')[0].querySelectorAll('td')).toHaveLength(2)
  })
})

/* ------------------------------------------------------------------ */
/*  List conversion branches (not covered by useEditor.spec.ts)        */
/* ------------------------------------------------------------------ */

describe('useEditor list conversion', () => {
  it('unwraps a bullet list back to paragraphs', () => {
    const el = createEditor('<ul><li>One</li><li>Two</li></ul>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('li')!.firstChild!, 0)

    editor.bulletList()

    expect(el.querySelector('ul')).toBeNull()
    expect(Array.from(el.querySelectorAll('p')).map((p) => p.textContent)).toEqual(['One', 'Two'])
  })

  it('converts a bullet list to an ordered list', () => {
    const el = createEditor('<ul><li>One</li><li>Two</li></ul>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('li')!.firstChild!, 0)

    editor.orderedList()

    expect(el.querySelector('ul')).toBeNull()
    expect(el.querySelector('ol')).not.toBeNull()
    expect(Array.from(el.querySelectorAll('ol > li')).map((li) => li.textContent)).toEqual(['One', 'Two'])
  })

  it('creates an ordered list with a placeholder item from a collapsed cursor', () => {
    const el = createEditor('<p></p>')
    const editor = useEditor(ref(el))
    setCollapsedSelection(el.querySelector('p')!, 0)

    editor.orderedList()

    expect(el.querySelector('ol > li')).not.toBeNull()
  })
})
