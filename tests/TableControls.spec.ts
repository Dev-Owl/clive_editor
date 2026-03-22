import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import TableControls from '@/components/TableControls.vue'

function setSelection(node: Node, offset = 0) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}

function mockRect(element: Element, rect: Partial<DOMRect>) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: rect.left ?? 0,
      y: rect.top ?? 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? rect.left ?? 0,
      bottom: rect.bottom ?? rect.top ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      toJSON: () => ({}),
    }),
  })
}

async function flushSelection() {
  await nextTick()
  await nextTick()
}

function createEditor(html: string): HTMLDivElement {
  const editor = document.createElement('div')
  editor.contentEditable = 'true'
  editor.innerHTML = html
  document.body.appendChild(editor)
  return editor
}

describe('TableControls', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('shows controls when the selection is inside a table cell', async () => {
    const editor = createEditor(`
      <table>
        <tbody>
          <tr><td>Alpha</td><td>Beta</td></tr>
          <tr><td>Gamma</td><td>Delta</td></tr>
        </tbody>
      </table>
    `)
    const table = editor.querySelector('table')!
    const cellText = editor.querySelector('td')!.firstChild!

    mockRect(editor, { top: 20, left: 10, right: 410, bottom: 320, width: 400, height: 300 })
    mockRect(table, { top: 100, left: 80, right: 280, bottom: 180, width: 200, height: 80 })

    const wrapper = mount(TableControls, {
      attachTo: document.body,
      props: {
        editorEl: editor,
      },
    })

    setSelection(cellText, 1)
    await flushSelection()

    expect(wrapper.find('.ce-table-controls').exists()).toBe(true)
    expect(wrapper.get('.ce-table-controls').attributes('style')).toContain('top: 44px;')
    expect(wrapper.get('.ce-table-controls').attributes('style')).toContain('left: 70px;')

    wrapper.unmount()
  })

  it('hides controls when disabled or when the selection leaves the editor', async () => {
    const editor = createEditor(`
      <table>
        <tbody>
          <tr><td>Alpha</td></tr>
          <tr><td>Beta</td></tr>
        </tbody>
      </table>
    `)
    const table = editor.querySelector('table')!
    const insideText = editor.querySelector('td')!.firstChild!
    const outside = document.createElement('p')
    outside.textContent = 'Outside'
    document.body.appendChild(outside)

    mockRect(editor, { top: 0, left: 0, right: 300, bottom: 300, width: 300, height: 300 })
    mockRect(table, { top: 80, left: 40, right: 240, bottom: 160, width: 200, height: 80 })

    const wrapper = mount(TableControls, {
      attachTo: document.body,
      props: {
        editorEl: editor,
      },
    })

    setSelection(insideText, 0)
    await flushSelection()
    expect(wrapper.find('.ce-table-controls').exists()).toBe(true)

    await wrapper.setProps({ disabled: true })
    await nextTick()
    expect(wrapper.find('.ce-table-controls').exists()).toBe(false)

    await wrapper.setProps({ disabled: false })
    setSelection(insideText, 0)
    await flushSelection()
    expect(wrapper.find('.ce-table-controls').exists()).toBe(true)

    setSelection(outside.firstChild!, 0)
    await flushSelection()
    expect(wrapper.find('.ce-table-controls').exists()).toBe(false)

    wrapper.unmount()
  })

  it('disables destructive actions when the current table structure does not allow them', async () => {
    const editor = createEditor(`
      <table>
        <thead>
          <tr><th>Header</th></tr>
        </thead>
        <tbody>
          <tr><td>Only body row</td></tr>
        </tbody>
      </table>
    `)
    const table = editor.querySelector('table')!
    const headerText = editor.querySelector('th')!.firstChild!

    mockRect(editor, { top: 0, left: 0, right: 300, bottom: 300, width: 300, height: 300 })
    mockRect(table, { top: 60, left: 30, right: 230, bottom: 140, width: 200, height: 80 })

    const wrapper = mount(TableControls, {
      attachTo: document.body,
      props: {
        editorEl: editor,
      },
    })

    setSelection(headerText, 0)
    await flushSelection()

    expect(wrapper.get('button[title="Remove row"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[title="Remove column"]').attributes('disabled')).toBeDefined()

    wrapper.unmount()
  })

  it('adds rows and columns, then emits change events', async () => {
    const editor = createEditor(`
      <table>
        <tbody>
          <tr><td>One</td><td>Two</td></tr>
          <tr><td>Three</td><td>Four</td></tr>
        </tbody>
      </table>
    `)
    const table = editor.querySelector('table')!
    const firstCellText = editor.querySelector('td')!.firstChild!

    mockRect(editor, { top: 10, left: 10, right: 410, bottom: 310, width: 400, height: 300 })
    mockRect(table, { top: 90, left: 70, right: 270, bottom: 170, width: 200, height: 80 })

    const wrapper = mount(TableControls, {
      attachTo: document.body,
      props: {
        editorEl: editor,
      },
    })

    setSelection(firstCellText, 0)
    await flushSelection()

    await wrapper.get('button[title="Add row below"]').trigger('click')
    await flushSelection()
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(3)

    await wrapper.get('button[title="Add column right"]').trigger('click')
    await flushSelection()
    expect(editor.querySelectorAll('tbody tr')[0].querySelectorAll('td')).toHaveLength(3)

    expect(wrapper.emitted('change')).toHaveLength(2)

    wrapper.unmount()
  })

  it('deletes the current table and replaces it with an empty paragraph', async () => {
    const editor = createEditor(`
      <table>
        <tbody>
          <tr><td>One</td><td>Two</td></tr>
          <tr><td>Three</td><td>Four</td></tr>
        </tbody>
      </table>
    `)
    const table = editor.querySelector('table')!
    const firstCellText = editor.querySelector('td')!.firstChild!

    mockRect(editor, { top: 0, left: 0, right: 300, bottom: 300, width: 300, height: 300 })
    mockRect(table, { top: 70, left: 50, right: 250, bottom: 150, width: 200, height: 80 })

    const wrapper = mount(TableControls, {
      attachTo: document.body,
      props: {
        editorEl: editor,
      },
    })

    setSelection(firstCellText, 0)
    await flushSelection()

    await wrapper.get('button[title="Delete table"]').trigger('click')
    await flushSelection()

    expect(editor.querySelector('table')).toBeNull()
    expect(editor.querySelector('p')?.innerHTML).toBe('<br>')
    expect(wrapper.find('.ce-table-controls').exists()).toBe(false)
    expect(wrapper.emitted('change')).toHaveLength(1)

    wrapper.unmount()
  })
})
