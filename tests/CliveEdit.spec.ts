import { mount } from '@vue/test-utils'
import { CalendarClock } from 'lucide-vue-next'
import { describe, expect, it } from 'vitest'
import CliveEdit from '@/components/CliveEdit.vue'
import type { ToolbarItem } from '@/types'

describe('CliveEdit custom toolbar integration', () => {
  it('allows a custom toolbar button to insert text in markdown mode', async () => {
    const toolbarItems: ToolbarItem[] = [
      {
        id: 'insert-date-time',
        label: 'Insert Date/Time',
        icon: CalendarClock,
        onClick: (ctx) => {
          ctx.insertText('2026-03-20 09:00')
        },
      },
    ]

    const wrapper = mount(CliveEdit, {
      props: {
        modelValue: '',
        mode: 'markdown',
        toolbarItems,
      },
    })

    await wrapper.get('button[aria-label="Insert Date/Time"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-03-20 09:00'])
  })
})
