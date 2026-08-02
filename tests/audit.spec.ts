import { describe, it } from 'vitest'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'

/** md -> html -> md -> html -> md ; unstable if pass1 !== pass2 */
const CORPUS: Record<string, string> = {
  'heading': '# Title\n\n## Sub\n\nText\n',
  'emphasis': 'A **bold** and *italic* and ~~strike~~ and `code`.\n',
  'link': 'See [docs](https://example.com/a_b) and https://example.com/x_y\n',
  'image': '![alt](https://example.com/i.png)\n',
  'image sized': '![alt](https://example.com/i.png "width=50%")\n',
  'hr': 'Above\n\n---\n\nBelow\n',
  'code plain': '```\nplain code\n```\n',
  'code lang': '```ts\nconst x: number = 1\n```\n',
  'code in list': '-   Item\n\n    ```js\n    const a = 1\n    ```\n',
  'code blank line': '```\na\n\nb\n```\n',
  'quote': '> Quoted line\n',
  'quote multi': '> Line one\n> Line two\n',
  'quote nested': '> Outer\n>\n> > Inner\n',
  'quote with list': '> -   One\n> -   Two\n',
  'quote with heading': '> ## Heading in quote\n',
  'list flat': '-   One\n-   Two\n',
  'list nested': '-   One\n    -   One.a\n    -   One.b\n-   Two\n',
  'list deep': '-   A\n    -   B\n        -   C\n',
  'list ordered': '1.  First\n2.  Second\n',
  'list ordered nested': '1.  First\n    1.  Inner\n',
  'list ordered start': '3.  Third\n4.  Fourth\n',
  'list mixed': '-   Bullet\n    1.  Number\n',
  'list formatting': '-   **Bold** item\n-   *Italic* item\n',
  'list link': '-   [Link](https://example.com)\n',
  'list loose': '-   One\n\n-   Two\n',
  'list multi para': '-   One\n\n    Second paragraph\n',
  'list with quote': '-   Item\n\n    > quoted\n',
  'table simple': '| A | B |\n| --- | --- |\n| 1 | 2 |\n',
  'table formatting': '| A | B |\n| --- | --- |\n| **x** | `y` |\n',
  'table list cell': '| A | B |\n| --- | --- |\n| - one<br>- two | 2 |\n',
  'table empty cell': '| A | B |\n| --- | --- |\n|  | 2 |\n',
  'table align': '| A | B |\n| :-- | --: |\n| 1 | 2 |\n',
  'table pipe escape': '| A | B |\n| --- | --- |\n| a \\| b | 2 |\n',
  'blank lines': 'One\n\n\nTwo\n',
  'hard break': 'One  \nTwo\n',
  'entities': 'AT&T <not-a-tag> "quotes"\n',
  'underscore word': 'snake_case_word and *em*\n',
  'html escape': 'a < b > c & d\n',
  'emoji': 'Hello 👋 world\n',
  'heading in list': '-   Item\n\n    # Heading\n',
  'nested quote list': '> -   One\n>     -   Two\n',
  'list then table': '-   One\n\n| A |\n| --- |\n| 1 |\n',
  'trailing spaces': 'text   \n',
  'setext-ish': 'Title\n=====\n',
  'numbered text': '2024. was a year\n',
  'indented code': '    indented code block\n',
}

describe('round-trip audit', () => {
  it('reports instability', () => {
    const unstable: string[] = []
    for (const [name, md] of Object.entries(CORPUS)) {
      let pass1 = ''
      let pass2 = ''
      let err = ''
      try {
        pass1 = serializeHtml(parseMarkdown(md))
        pass2 = serializeHtml(parseMarkdown(pass1))
      } catch (e) { err = String(e) }
      if (err || pass1.trim() !== pass2.trim()) {
        unstable.push(`\n### ${name}\nIN:    ${JSON.stringify(md)}\nPASS1: ${JSON.stringify(pass1)}\nPASS2: ${JSON.stringify(pass2)}\n${err}`)
      }
    }
    process.stderr.write(`\n===== UNSTABLE: ${unstable.length}/${Object.keys(CORPUS).length} =====\n${unstable.join('\n')}\n`)
  })
})
