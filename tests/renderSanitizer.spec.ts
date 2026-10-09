import DOMPurify from 'dompurify'
import { describe, expect, it, vi } from 'vitest'
import { sanitizeRenderedHtml } from '@/utils/renderSanitizer'
import { parseMarkdown } from '@/utils/markdown'

const toDom = (html: string) => {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

describe('sanitizeRenderedHtml', () => {
  it('removes script, event handlers and javascript: URLs', () => {
    const dom = toDom(sanitizeRenderedHtml(
      '<p onclick="alert(1)">a</p><script>alert(1)</script>'
      + '<img src="x" onerror="alert(1)"><a href="java&#9;script:alert(1)">l</a>'
      + '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>',
    ))

    expect(dom.querySelector('script')).toBeNull()
    expect(dom.querySelector('[onclick], [onerror]')).toBeNull()
    expect(dom.querySelector('a')?.hasAttribute('href')).toBe(false)
    expect(dom.querySelector('animate')).toBeNull()
  })

  it('keeps the markup the editor renders', () => {
    const html = '<h2 id="title">Title</h2>'
      + '<pre class="shiki" style="background-color:#fff" tabindex="0">'
      + '<div class="ce-code-lang" contenteditable="false" data-lang="ts">ts</div>'
      + '<code class="language-ts"><span class="line"><span style="color:#D73A49">const</span></span></code></pre>'
      + '<p><img src="data:image/png;base64,AAAA" alt="a" style="height: auto; width: 50%;" data-ce-width="50%"></p>'
      + '<table><thead><tr><th style="text-align:right">h</th></tr></thead></table>'
      + '<p><a href="https://example.com/?a=1&amp;b=2">link</a><br></p>'

    expect(sanitizeRenderedHtml(html)).toBe(html)
  })

  it('keeps heading anchors whose slug shadows a document property', () => {
    for (const slug of ['title', 'cookie', 'location', 'body']) {
      const dom = toDom(sanitizeRenderedHtml(`<h1 id="${slug}">x</h1>`))
      expect(dom.querySelector('h1')?.id).toBe(slug)
    }
  })

  it('still drops shadowing ids on other elements', () => {
    const dom = toDom(sanitizeRenderedHtml('<img id="cookie" src="x"><form id="title"></form>'))
    expect(dom.querySelector('img')?.id).toBe('')
  })

  it('only allows the "not editable" marker', () => {
    const dom = toDom(sanitizeRenderedHtml(
      '<div class="ce-code-lang" contenteditable="false">ts</div><p contenteditable="true">x</p>',
    ))

    expect(dom.querySelector('.ce-code-lang')?.getAttribute('contenteditable')).toBe('false')
    expect(dom.querySelector('p')?.hasAttribute('contenteditable')).toBe(false)
  })

  it('does not change the global DOMPurify instance of the host application', () => {
    sanitizeRenderedHtml('<h1 id="title">x</h1>')
    const dom = toDom(DOMPurify.sanitize('<h1 id="title">x</h1><p contenteditable="false">x</p>'))

    // Default DOMPurify behaviour, untouched by our hooks and config
    expect(dom.querySelector('h1')?.id).toBe('')
    expect(dom.querySelector('p')?.hasAttribute('contenteditable')).toBe(false)
  })
})

describe('parseMarkdown sanitising', () => {
  it('sanitises by default, even when a renderer lets markup through', () => {
    const highlight = () => '<pre><code><img src="x" onerror="alert(1)">code</code></pre>'
    const dom = toDom(parseMarkdown('```ts\ncode\n```', { highlight }))

    expect(dom.querySelector('[onerror]')).toBeNull()
    expect(dom.querySelector('.ce-code-lang')?.getAttribute('data-lang')).toBe('ts')
  })

  it('keeps heading anchors', () => {
    expect(parseMarkdown('# Title')).toContain('<h1 id="title">Title</h1>')
  })

  it('uses a custom sanitize function instead of the default', () => {
    const sanitize = vi.fn((html: string) => html.replace('Hello', 'Bye'))
    const html = parseMarkdown('# Hello', { sanitize })

    expect(sanitize).toHaveBeenCalledTimes(1)
    expect(sanitize.mock.calls[0][0]).toContain('<h1 id="hello">Hello</h1>')
    expect(html).toContain('<h1 id="hello">Bye</h1>')
  })
})
