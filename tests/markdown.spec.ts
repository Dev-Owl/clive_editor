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
})
