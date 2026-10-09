import { describe, expect, it } from 'vitest'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'

describe('markdown utils', () => {
  it('adds heading anchor ids when parsing markdown', () => {
    const html = parseMarkdown('# Hello World')
    expect(html).toContain('<h1 id="hello-world">Hello World</h1>')
  })

  it('preserves nested list structure through markdown to html to markdown roundtrip', () => {
    const markdown = '- Parent\n    - Child'
    const html = parseMarkdown(markdown)
    const roundtrip = serializeHtml(html)

    expect(html).toContain('<ul>')
    expect(html).toContain('<li>Parent')
    expect(html).toContain('<li>Child</li>')
    expect(roundtrip).toContain('-   Parent')
    expect(roundtrip).toContain('    -   Child')
  })

  it('sanitizes malformed markdown tables when parsing', () => {
    const markdown = '| Head |\n| Cell 1 | Cell 2 |'
    const html = parseMarkdown(markdown)

    expect(html).toContain('<table>')
    expect(html).toContain('<th>Head</th>')
    expect(html).toContain('<th></th>')
    expect(html).toContain('<td>Cell 1</td>')
    expect(html).toContain('<td>Cell 2</td>')
  })

  it('serializes autolinks as raw urls', () => {
    const markdown = serializeHtml('<p><a href="https://example.com/a_b">https://example.com/a_b</a></p>')
    expect(markdown.trim()).toBe('https://example.com/a_b')
  })

  it('serializes fenced code blocks with language labels', () => {
    const markdown = serializeHtml('<pre><div class="ce-code-lang" data-lang="ts">ts</div><code class="language-ts">const x = 1;\n</code></pre>')
    expect(markdown).toContain('```ts')
    expect(markdown).toContain('const x = 1;')
  })

  it('preserves a trailing blank line when serializing fenced code blocks', () => {
    const markdown = serializeHtml('<pre><code>asdasdsd\n</code></pre>')

    expect(markdown).toContain('```\nasdasdsd\n\n```')
  })

  it('parses fenced code blocks without adding a phantom trailing blank line', () => {
    const html = parseMarkdown('```js\nconst x = 1;\n```')
    const container = document.createElement('div')
    container.innerHTML = html

    expect(container.querySelector('pre code')?.textContent).toBe('const x = 1;')
  })

  it('round-trips resized images through markdown metadata', () => {
    const html = '<p><img src="https://example.com/image.png" alt="Preview" data-ce-width="75%" style="width: 75%; height: auto;"></p>'
    const markdown = serializeHtml(html)
    const roundtrip = parseMarkdown(markdown)
    const container = document.createElement('div')
    container.innerHTML = roundtrip
    const image = container.querySelector('img')

    expect(markdown.trim()).toBe('![Preview](https://example.com/image.png "ce-width:75%")')
    expect(image?.getAttribute('data-ce-width')).toBe('75%')
    expect(image?.style.width).toBe('75%')
    expect(image?.getAttribute('title')).toBeNull()
  })

  it('preserves blank lines created with repeated visual line breaks', () => {
    const markdown = serializeHtml('<p>Line 1<br><br><br>Line 4</p>')
    const roundtrip = parseMarkdown(markdown)
    const container = document.createElement('div')
    container.innerHTML = roundtrip

    expect(markdown).toContain('\u200B')
    expect(container.querySelector('p')?.textContent).toMatch(/^Line 1\s+Line 4$/)
    expect(container.querySelectorAll('p br')).toHaveLength(3)
  })

  it('preserves empty visual paragraphs through markdown roundtrip', () => {
    const html = '<p>Line 1</p><p><br></p><p>Line 2</p><p><br></p><p>Line 3</p>'
    const markdown = serializeHtml(html)
    const roundtrip = parseMarkdown(markdown)
    const container = document.createElement('div')
    container.innerHTML = roundtrip
    const paragraphs = Array.from(container.querySelectorAll('p')).map((paragraph) => paragraph.innerHTML)

    expect(markdown).toContain('\u200B')
    expect(paragraphs).toEqual(['Line 1', '<br>', 'Line 2', '<br>', 'Line 3'])
  })

  it('serializes tables with generated separator rows', () => {
    const markdown = serializeHtml('<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>')
    expect(markdown).toContain('| A | B |')
    expect(markdown).toContain('| --- | --- |')
    expect(markdown).toContain('| C | D |')
  })

  it('round-trips bullet lists inside table cells via <br> markers', () => {
    const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td><ul><li>One</li><li><strong>Two</strong></li></ul></td></tr></tbody></table>'
    const markdown = serializeHtml(html)
    const roundtrip = parseMarkdown(markdown)

    expect(markdown).toContain('| Header |')
    expect(markdown).toContain('| - One <br> - **Two** |')
    expect(roundtrip).toContain('<td><ul><li>One</li><li><strong>Two</strong></li></ul></td>')
  })

  it('round-trips mixed bullet and ordered lists inside table cells', () => {
    const html = '<table><thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead><tbody><tr><td><ul><li>asdasdas</li><li>asdasdas</li><li>asdasasd</li></ul><ol><li>asdasd</li></ol></td><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td><td>Cell</td></tr></tbody></table>'
    const markdown = serializeHtml(html)
    const roundtrip = parseMarkdown(markdown)

    expect(markdown).toContain('| - asdasdas <br> - asdasdas <br> - asdasasd <br> 1. asdasd |')
    expect(roundtrip).toContain('<td><ul><li>asdasdas</li><li>asdasdas</li><li>asdasasd</li></ul><ol><li>asdasd</li></ol></td>')
  })

  it('expands colspan cells into multiple markdown columns', () => {
    const html = '<table><thead><tr><th colspan="2">Wide</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>'
    const markdown = serializeHtml(html)

    // The colspan header must occupy two columns, padded with an empty cell,
    // and the separator row must have two columns to match.
    expect(markdown).toContain('| Wide |  |')
    expect(markdown).toContain('| --- | --- |')
    expect(markdown).toContain('| A | B |')
  })

  it('preserves plain-text segments interleaved with lists in a table cell', () => {
    const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Intro<br><ul><li>One</li></ul><br>Outro</td></tr></tbody></table>'
    const markdown = serializeHtml(html)
    const roundtrip = parseMarkdown(markdown)

    // Both the plain text and the list survive the round-trip.
    expect(markdown).toContain('Intro')
    expect(markdown).toContain('- One')
    expect(markdown).toContain('Outro')
    expect(roundtrip).toContain('Intro')
    expect(roundtrip).toContain('<li>One</li>')
    expect(roundtrip).toContain('Outro')
  })

  describe('code block language label (XSS regression)', () => {
    const toDom = (html: string) => {
      const container = document.createElement('div')
      container.innerHTML = html
      return container
    }

    const elementPayload = '"><img src=x onerror=alert(1)>'
    const attributePayload = 'x" onmouseover="alert(1)'

    it('does not turn a crafted info string into an element', () => {
      const dom = toDom(parseMarkdown(`\`\`\`${elementPayload}\ncode\n\`\`\``))

      expect(dom.querySelector('img')).toBeNull()
      expect(dom.querySelector('[onerror]')).toBeNull()
      expect(dom.querySelectorAll('pre')).toHaveLength(1)
    })

    it('does not let a crafted info string add attributes to the label', () => {
      const dom = toDom(parseMarkdown(`~~~${attributePayload}\ncode\n~~~`))
      const label = dom.querySelector('.ce-code-lang') as HTMLElement

      expect(dom.querySelector('[onmouseover]')).toBeNull()
      expect(label.dataset.lang).toBe(attributePayload)
      expect(label.textContent).toBe(attributePayload)
    })

    it('escapes the label when a highlighter is used', () => {
      const highlight = (code: string) => `<pre class="shiki"><code>${code}</code></pre>`
      const dom = toDom(parseMarkdown(`\`\`\`${elementPayload}\ncode\n\`\`\``, { highlight }))

      expect(dom.querySelector('img')).toBeNull()
      expect(dom.querySelector('[onerror]')).toBeNull()
      expect((dom.querySelector('.ce-code-lang') as HTMLElement).dataset.lang).toBe(elementPayload)
    })

    it('keeps `$` sequences in the language literal when a highlighter is used', () => {
      const highlight = (code: string) => `<pre class="shiki"><code>${code}</code></pre>`
      const dom = toDom(parseMarkdown('```a$&b$1c\ncode\n```', { highlight }))
      const label = dom.querySelector('.ce-code-lang') as HTMLElement

      expect(label.dataset.lang).toBe('a$&b$1c')
      expect(dom.querySelector('code')?.className).toBe('language-a$&b$1c')
      expect(dom.querySelectorAll('pre')).toHaveLength(1)
    })

    it('still round-trips an ordinary language', () => {
      const html = parseMarkdown('```ts\nconst a = 1\n```')

      expect(html).toContain('data-lang="ts"')
      expect(serializeHtml(html)).toContain('```ts\nconst a = 1\n```')
    })
  })
})
