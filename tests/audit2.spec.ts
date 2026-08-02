import { describe, it } from 'vitest'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'

const CASES: Record<string, string> = {
  'code in list': '-   Item\n\n    ```js\n    const a = 1\n    ```\n',
  'list multi para': '-   One\n\n    Second paragraph\n',
  'list with quote': '-   Item\n\n    > quoted\n',
  'heading in list': '-   Item\n\n    # Heading\n',
  'list loose': '-   One\n\n-   Two\n',
}

describe('convergence', () => {
  it('iterates', () => {
    for (const [name, md] of Object.entries(CASES)) {
      process.stderr.write(`\n### ${name}\n  IN  : ${JSON.stringify(md)}\n`)
      let cur = md
      for (let i = 1; i <= 4; i++) {
        const html = parseMarkdown(cur)
        cur = serializeHtml(html)
        process.stderr.write(`  P${i}  : ${JSON.stringify(cur)}\n`)
        if (i === 4) process.stderr.write(`  HTML: ${JSON.stringify(parseMarkdown(cur))}\n`)
      }
    }
  })
})
