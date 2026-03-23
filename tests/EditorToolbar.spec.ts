import { mount } from '@vue/test-utils'
import { Bold, Smile } from 'lucide-vue-next'
import { describe, expect, it, vi } from 'vitest'
import EditorToolbar from '@/components/EditorToolbar.vue'
import type { EditorContext, ToolbarItem } from '@/types'

function createContext(): EditorContext {
  return {
    mode: 'wysiwyg',
    disabled: false,
    bold: vi.fn(),
    italic: vi.fn(),
    strikethrough: vi.fn(),
    heading: vi.fn(),
    bulletList: vi.fn(),
    orderedList: vi.fn(),
    indentList: vi.fn(),
    outdentList: vi.fn(),
    blockquote: vi.fn(),
    codeInline: vi.fn(),
    codeBlock: vi.fn(),
    link: vi.fn(),
    image: vi.fn(),
    horizontalRule: vi.fn(),
    table: vi.fn(),
    emoji: vi.fn(),
    insertText: vi.fn(),
    insertMarkdown: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: true,
    toggleMode: vi.fn(),
    isActive: vi.fn(() => false),
  }
}

describe('EditorToolbar', () => {
  it('emits an action for built-in toolbar items', async () => {
    const wrapper = mount(EditorToolbar, {
      props: {
        mode: 'wysiwyg',
        ctx: createContext(),
        customItems: [
          { id: 'bold', label: 'Bold', icon: Bold, action: 'bold' } satisfies ToolbarItem,
        ],
      },
    })

    await wrapper.get('button[aria-label="Bold"]').trigger('click')

    expect(wrapper.emitted('action')?.[0]).toEqual(['bold'])
  })

  it('calls onClick for custom toolbar items', async () => {
    const ctx = createContext()
    const onClick = vi.fn()
    const wrapper = mount(EditorToolbar, {
      props: {
        mode: 'wysiwyg',
        ctx,
        customItems: [
          { id: 'custom', label: 'Custom', icon: Bold, onClick } satisfies ToolbarItem,
        ],
      },
    })

    await wrapper.get('button[aria-label="Custom"]').trigger('click')

    expect(onClick).toHaveBeenCalledWith(ctx)
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('filters only the built-in emoji action when emoji support is disabled', () => {
    const wrapper = mount(EditorToolbar, {
      props: {
        mode: 'wysiwyg',
        ctx: createContext(),
        enableEmoji: false,
        customItems: [
          { id: 'emoji', label: 'Emoji', icon: Smile, action: 'emoji' } satisfies ToolbarItem,
          { id: 'custom-emoji', label: 'Custom Emoji', icon: Smile, onClick: vi.fn() } satisfies ToolbarItem,
        ],
      },
    })

    expect(wrapper.find('button[aria-label="Emoji"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Custom Emoji"]').exists()).toBe(true)
  })

  it('keeps list controls enabled for built-in toolbar items', () => {
    const wrapper = mount(EditorToolbar, {
      props: {
        mode: 'wysiwyg',
        ctx: createContext(),
      },
    })

    expect(wrapper.get('button[aria-label="Bullet List"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="Ordered List"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="Indent List"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="Outdent List"]').attributes('disabled')).toBeUndefined()
  })
})
