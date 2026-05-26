import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

function mountEditor(modelValue: string) {
  return mount(MarkdownEditor, {
    props: {
      modelValue,
    },
  })
}

function selectLine(textarea: HTMLTextAreaElement, lineText: string) {
  const start = textarea.value.indexOf(lineText)
  textarea.selectionStart = start
  textarea.selectionEnd = start + lineText.length
}

describe('MarkdownEditor', () => {
  it('does not indent a single list item', async () => {
    const wrapper = mountEditor('- Test')
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    selectLine(textarea, '- Test')

    ;(wrapper.vm as unknown as { indentList: () => void }).indentList()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('indents only when a valid previous sibling exists', async () => {
    const wrapper = mountEditor('- Parent\n- Child')
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    selectLine(textarea, '- Child')

    ;(wrapper.vm as unknown as { indentList: () => void }).indentList()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['- Parent\n    - Child'])
  })

  it('does not indent a nested item beyond one valid level', async () => {
    const wrapper = mountEditor('- Parent\n    - Child')
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    selectLine(textarea, '- Child')

    ;(wrapper.vm as unknown as { indentList: () => void }).indentList()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('outdents a nested list item by one level', async () => {
    const wrapper = mountEditor('- Parent\n    - Child')
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    selectLine(textarea, '- Child')

    ;(wrapper.vm as unknown as { outdentList: () => void }).outdentList()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['- Parent\n- Child'])
  })

  it('does not duplicate an existing bullet marker when the bullet-list command is used', async () => {
    const wrapper = mountEditor('- Progress')
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    selectLine(textarea, '- Progress')

    ;(wrapper.vm as unknown as { bulletList: () => void }).bulletList()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
