import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownViewer from '@/components/MarkdownViewer.vue'

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
})
