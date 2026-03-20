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
})
