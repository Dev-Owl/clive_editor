import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownViewer from '@/components/MarkdownViewer.vue'

const highlighterMock = vi.hoisted(() => ({
  initHighlighter: vi.fn(async () => true),
  highlightCode: vi.fn((code: string) => `<pre class="mock-hl"><code>${code}</code></pre>`),
  isHighlighterReady: vi.fn(() => false),
}))

vi.mock('@/utils/highlighter', () => highlighterMock)

describe('MarkdownViewer', () => {
  it('renders markdown as html', () => {
    const wrapper = mount(MarkdownViewer, {
      props: {
        modelValue: '# Hello\n\nThis is **markdown**.',
      },
    })

    expect(wrapper.find('h1').text()).toBe('Hello')
    expect(wrapper.find('strong').text()).toBe('markdown')
    expect(wrapper.classes()).toContain('ce-viewer--bordered')
  })

  it('updates rendered output and supports disabling the border', async () => {
    const wrapper = mount(MarkdownViewer, {
      props: {
        modelValue: 'Initial text',
        bordered: false,
      },
    })

    expect(wrapper.classes()).not.toContain('ce-viewer--bordered')
    expect(wrapper.text()).toContain('Initial text')

    await wrapper.setProps({
      modelValue: '- One\n- Two',
    })

    expect(wrapper.findAll('li')).toHaveLength(2)
  })

  describe('standalone syntax highlighting', () => {
    afterEach(() => {
      highlighterMock.initHighlighter.mockClear()
      highlighterMock.highlightCode.mockClear()
      highlighterMock.isHighlighterReady.mockReturnValue(false)
    })

    it('initializes the local highlighter when highlightOptions are provided', async () => {
      mount(MarkdownViewer, {
        props: {
          modelValue: '```js\nconst x = 1\n```',
          highlightOptions: { theme: 'github-light' },
        },
      })

      await flushPromises()

      expect(highlighterMock.initHighlighter).toHaveBeenCalledWith({ theme: 'github-light' })
    })

    it('uses the local highlighter output once it is ready', async () => {
      // Highlighter reports ready so renderedHtml takes the local highlight path.
      highlighterMock.isHighlighterReady.mockReturnValue(true)

      const wrapper = mount(MarkdownViewer, {
        props: {
          modelValue: '```js\nconst x = 1\n```',
          highlightOptions: { theme: 'github-light' },
        },
      })

      await flushPromises()

      expect(highlighterMock.highlightCode).toHaveBeenCalled()
      expect(wrapper.html()).toContain('mock-hl')
    })

    it('re-initializes when highlightOptions are set later', async () => {
      const wrapper = mount(MarkdownViewer, {
        props: { modelValue: '```js\nx\n```' },
      })
      await flushPromises()
      highlighterMock.initHighlighter.mockClear()

      await wrapper.setProps({ highlightOptions: { theme: 'github-dark' } })
      await flushPromises()

      expect(highlighterMock.initHighlighter).toHaveBeenCalledWith({ theme: 'github-dark' })
    })
  })
})
