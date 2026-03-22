import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from '@/utils/sanitize'

describe('sanitizeHtml', () => {
  it('removes dangerous elements together with their content', () => {
    const dirty = `
      <p>Safe</p>
      <script>alert('xss')</script>
      <style>body { color: red; }</style>
      <iframe src="https://example.com"></iframe>
      <form><input value="secret" /></form>
    `

    const clean = sanitizeHtml(dirty)

    expect(clean).toContain('<p>Safe</p>')
    expect(clean).not.toContain('alert(')
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('<style')
    expect(clean).not.toContain('<iframe')
    expect(clean).not.toContain('<form')
    expect(clean).not.toContain('<input')
  })

  it('strips event handlers, inline styles, comments, and non-whitelisted attributes', () => {
    const dirty = `
      <!-- comment -->
      <a href="https://example.com" onclick="evil()" style="color:red" data-id="1" title="Example">Link</a>
      <img src="/image.png" alt="Preview" width="120" height="80" loading="lazy" />
    `

    const clean = sanitizeHtml(dirty)

    expect(clean).toContain('<a href="https://example.com" title="Example">Link</a>')
    expect(clean).toContain('<img src="/image.png" alt="Preview" width="120" height="80">')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('style=')
    expect(clean).not.toContain('data-id')
    expect(clean).not.toContain('loading=')
    expect(clean).not.toContain('<!--')
  })

  it('removes unsafe href and src values but keeps safe ones', () => {
    const dirty = `
      <a href="javascript:alert('xss')" title="Bad">Bad Link</a>
      <a href="https://example.com/docs">Good Link</a>
      <img src="data:text/html;base64,PHNjcmlwdD4=" alt="Bad image" />
      <img src="https://example.com/image.png" alt="Good image" class="preview" />
    `

    const clean = sanitizeHtml(dirty)

    expect(clean).toContain('<a title="Bad">Bad Link</a>')
    expect(clean).toContain('<a href="https://example.com/docs">Good Link</a>')
    expect(clean).toContain('<img alt="Bad image">')
    expect(clean).toContain('<img src="https://example.com/image.png" alt="Good image" class="preview">')
    expect(clean).not.toContain('javascript:')
    expect(clean).not.toContain('data:text/html')
  })
})
