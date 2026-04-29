import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import CliveEdit from '@/components/CliveEdit.vue'

describe('CliveEdit mode switching', () => {
  it('preserves nested list structure when switching from markdown to visual mode', async () => {
    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: '- Parent\n    - Child',
        mode: 'markdown',
      },
    })

    await wrapper.get('button[aria-label="Switch to Visual mode"]').trigger('click')
    await nextTick()
    await nextTick()

    expect(wrapper.find('.ce-wysiwyg ul > li > ul > li').exists()).toBe(true)
    expect(wrapper.find('.ce-wysiwyg').text()).toContain('Parent')
    expect(wrapper.find('.ce-wysiwyg').text()).toContain('Child')
  })

  it('preserves resized images when switching between visual and markdown modes', async () => {
    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: '![Preview](https://example.com/image.png "ce-width:75%")',
        mode: 'markdown',
      },
      attachTo: document.body,
    })

    await wrapper.get('button[aria-label="Switch to Visual mode"]').trigger('click')
    await nextTick()
    await nextTick()

    const image = wrapper.get('.ce-wysiwyg img')
    expect(image.attributes('data-ce-width')).toBe('75%')
    expect((image.element as HTMLImageElement).style.width).toBe('75%')

    await wrapper.get('button[aria-label="Switch to Markdown mode"]').trigger('click')
    await nextTick()
    await nextTick()

    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(
      '![Preview](https://example.com/image.png "ce-width:75%")',
    )
  })
})
