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

  describe('code copy button', () => {
    const CODE_MARKDOWN = '```js\nconst x = 1\n```'

    function mockClipboard() {
      const writeText = vi.fn(async () => undefined)
      Object.assign(navigator, { clipboard: { writeText } })
      return writeText
    }

    afterEach(() => {
      vi.useRealTimers()
    })

    it('adds a copy button to code blocks by default', () => {
      const wrapper = mount(MarkdownViewer, {
        props: { modelValue: CODE_MARKDOWN },
      })

      const button = wrapper.find('.ce-code-copy')
      expect(button.exists()).toBe(true)
      expect(button.attributes('aria-label')).toBe('Copy code')
      expect(wrapper.find('pre').classes()).toContain('ce-has-code-copy')
    })

    it('can be switched off', () => {
      const wrapper = mount(MarkdownViewer, {
        props: { modelValue: CODE_MARKDOWN, codeCopyButton: false },
      })

      expect(wrapper.find('.ce-code-copy').exists()).toBe(false)
      expect(wrapper.find('pre').exists()).toBe(true)
    })

    it('leaves inline code alone', () => {
      const wrapper = mount(MarkdownViewer, {
        props: { modelValue: 'Some `inline` code' },
      })

      expect(wrapper.find('.ce-code-copy').exists()).toBe(false)
    })

    it('copies the code of the block it belongs to', async () => {
      const writeText = mockClipboard()
      const wrapper = mount(MarkdownViewer, {
        props: { modelValue: `First\n\n${CODE_MARKDOWN}\n\n\`\`\`\nsecond block\n\`\`\`` },
      })

      await wrapper.findAll('.ce-code-copy')[1].trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledWith('second block')
    })

    it('confirms the copy on the button and resets afterwards', async () => {
      vi.useFakeTimers()
      mockClipboard()
      const wrapper = mount(MarkdownViewer, {
        props: { modelValue: CODE_MARKDOWN },
      })

      await wrapper.find('.ce-code-copy').trigger('click')
      await vi.waitFor(() => expect(wrapper.find('.ce-code-copy').classes()).toContain('is-copied'))
      expect(wrapper.find('.ce-code-copy').attributes('aria-label')).toBe('Copied')

      vi.advanceTimersByTime(2000)
      expect(wrapper.find('.ce-code-copy').classes()).not.toContain('is-copied')
      expect(wrapper.find('.ce-code-copy').attributes('aria-label')).toBe('Copy code')
    })

    it('falls back to a selection copy when the clipboard API is unavailable', async () => {
      Object.assign(navigator, { clipboard: undefined })
      const execCommand = vi.fn(() => true)
      Object.assign(document, { execCommand })

      const wrapper = mount(MarkdownViewer, {
        props: { modelValue: CODE_MARKDOWN },
      })

      await wrapper.find('.ce-code-copy').trigger('click')
      await flushPromises()

      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(wrapper.find('.ce-code-copy').classes()).toContain('is-copied')
    })
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
