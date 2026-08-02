import { describe, expect, it } from 'vitest'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'

/**
 * Round-trip stability guard.
 *
 * Every edit in Visual mode writes `serializeHtml(dom)` back to the model, so
 * a document that changes when it is parsed and serialized again keeps
 * changing on every edit. That is how the doubled list marker (`-   -   item`)
 * got into stored documents: an unrepresentable DOM state was written as
 * markdown that re-parsed into something else.
 *
 * A sample is stable when the second pass equals the first — the first pass
 * may normalize (setext headings become ATX, markers are padded), later ones
 * must not drift.
 */
const SAMPLES: Record<string, string> = {
  heading: '# Title\n\n## Sub\n\nText\n',
  emphasis: 'A **bold** and *italic* and ~~strike~~ and `code`.\n',
  link: 'See [docs](https://example.com/a_b) and https://example.com/x_y\n',
  image: '![alt](https://example.com/i.png)\n',
  'image with size': '![alt](https://example.com/i.png "width=50%")\n',
  'horizontal rule': 'Above\n\n---\n\nBelow\n',
  'code block': '```\nplain code\n```\n',
  'code block with language': '```ts\nconst x: number = 1\n```\n',
  'code block with blank line': '```\na\n\nb\n```\n',
  quote: '> Quoted line\n',
  'quote over two lines': '> Line one\n> Line two\n',
  'nested quote': '> Outer\n>\n> > Inner\n',
  'quote with list': '> -   One\n> -   Two\n',
  'quote with heading': '> ## Heading in quote\n',
  list: '-   One\n-   Two\n',
  'nested list': '-   One\n    -   One.a\n    -   One.b\n-   Two\n',
  'three level list': '-   A\n    -   B\n        -   C\n',
  'ordered list': '1.  First\n2.  Second\n',
  'nested ordered list': '1.  First\n    1.  Inner\n',
  'ordered list with start': '3.  Third\n4.  Fourth\n',
  'mixed list': '-   Bullet\n    1.  Number\n',
  'list with formatting': '-   **Bold** item\n-   *Italic* item\n',
  'list with link': '-   [Link](https://example.com)\n',
  'loose list': '-   One\n\n-   Two\n',
  'list item with two paragraphs': '-   One\n\n    Second paragraph\n',
  'list item with code block': '-   Item\n\n    ```js\n    const a = 1\n    ```\n',
  'list item with quote': '-   Item\n\n    > quoted\n',
  'list item with heading': '-   Item\n\n    # Heading\n',
  table: '| A | B |\n| --- | --- |\n| 1 | 2 |\n',
  'table with formatting': '| A | B |\n| --- | --- |\n| **x** | `y` |\n',
  'table with list cell': '| A | B |\n| --- | --- |\n| - one<br>- two | 2 |\n',
  'table with empty cell': '| A | B |\n| --- | --- |\n|  | 2 |\n',
  'table with alignment': '| A | B | C |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n',
  'table with escaped pipe': '| A | B |\n| --- | --- |\n| a \\| b | 2 |\n',
  'blank lines': 'One\n\n\nTwo\n',
  'hard break': 'One  \nTwo\n',
  entities: 'AT&T <not-a-tag>\n',
  'emoji': 'Hello 👋 world\n',
  'list followed by table': '-   One\n\n| A |\n| --- |\n| 1 |\n',
}

describe('markdown round-trip stability', () => {
  for (const [name, markdown] of Object.entries(SAMPLES)) {
    it(`stays stable: ${name}`, () => {
      const first = serializeHtml(parseMarkdown(markdown))
      const second = serializeHtml(parseMarkdown(first))

      expect(second).toBe(first)
    })
  }

  it('never writes the blank-line placeholder into a list', () => {
    const markdown = serializeHtml(parseMarkdown('-   One\n\n-   Two\n\n-   Three\n'))

    expect(markdown).not.toContain('​')
    expect(markdown).toBe('-   One\n\n-   Two\n\n-   Three')
  })

  it('keeps column alignment through a round-trip', () => {
    const markdown = '| A | B | C |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n'
    const html = parseMarkdown(markdown)

    expect(html).toContain('text-align:left')
    expect(html).toContain('text-align:center')
    expect(html).toContain('text-align:right')
    expect(serializeHtml(html)).toContain('| :--- | :---: | ---: |')
  })

  it('escapes a pipe typed into a table cell instead of adding a column', () => {
    const markdown = serializeHtml(
      '<table><thead><tr><th>A</th><th>B</th></tr></thead>'
      + '<tbody><tr><td>a | b</td><td>2</td></tr></tbody></table>',
    )

    expect(markdown).toContain('| a \\| b | 2 |')
    expect(parseMarkdown(markdown)).toContain('<td>a | b</td>')
  })

  it('keeps a list item that owns a code block together', () => {
    const markdown = '-   Item\n\n    ```js\n    const a = 1\n    ```\n'
    const html = parseMarkdown(serializeHtml(parseMarkdown(markdown)))

    expect(html.replace(/\n/g, '')).toContain('<li><p>Item</p><pre>')
  })
})
