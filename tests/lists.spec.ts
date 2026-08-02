import { describe, expect, it } from 'vitest'
import {
  getListItemOwnContentEnd,
  isListWrapperOnlyItem,
  listItemHasOwnContent,
  repairOrphanedListItems,
} from '@/utils/lists'
import { parseMarkdown, serializeHtml } from '@/utils/markdown'

function render(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

describe('list structure helpers', () => {
  it('detects list items that only wrap a nested list', () => {
    const root = render('<ul><li>Parent</li><li><ul><li>Child</li></ul></li><li><br></li></ul>')
    const items = root.querySelectorAll('li')

    expect(isListWrapperOnlyItem(items[0])).toBe(false)
    expect(isListWrapperOnlyItem(items[1])).toBe(true)
    expect(isListWrapperOnlyItem(items[2])).toBe(false)
  })

  it('reports own content independently of nested lists', () => {
    const root = render('<ul><li>Parent<ul><li>Child</li></ul></li><li><ul><li>Child</li></ul></li></ul>')
    const items = root.querySelectorAll('li')

    expect(listItemHasOwnContent(items[0])).toBe(true)
    expect(getListItemOwnContentEnd(items[0])).toBe(1)
    expect(listItemHasOwnContent(items[2])).toBe(false)
    expect(getListItemOwnContentEnd(items[2])).toBe(0)
  })

  it('merges an orphaned item back into the preceding item', () => {
    const root = render(
      '<ul><li>Draak import</li><li><ul><li>Re-download the db</li><li>Re-run the import</li></ul></li></ul>',
    )

    expect(repairOrphanedListItems(root)).toBe(true)
    expect(root.innerHTML).toBe(
      '<ul><li>Draak import<ul><li>Re-download the db</li><li>Re-run the import</li></ul></li></ul>',
    )
  })

  it('merges into the sub-list the preceding item already has', () => {
    const root = render(
      '<ul><li>Parent<ul><li>First</li></ul></li><li><ul><li>Second</li></ul></li></ul>',
    )

    repairOrphanedListItems(root)

    const nested = root.querySelectorAll('li > ul')
    expect(nested).toHaveLength(1)
    expect(Array.from(nested[0].children).map((li) => li.textContent)).toEqual(['First', 'Second'])
  })

  it('lifts the nested items when there is no preceding item', () => {
    const root = render('<ul><li><ul><li>Only</li><li>Items</li></ul></li></ul>')

    repairOrphanedListItems(root)

    expect(root.innerHTML).toBe('<ul><li>Only</li><li>Items</li></ul>')
  })

  it('leaves the item holding the caret untouched', () => {
    const root = render('<ul><li>Parent</li><li><ul><li>Child</li></ul></li></ul>')
    const orphan = root.querySelectorAll('li')[1]

    expect(repairOrphanedListItems(root, { protectedNodes: [orphan] })).toBe(false)
    expect(root.querySelectorAll('li')).toHaveLength(3)
  })

  it('leaves well-formed lists alone', () => {
    const root = render('<ul><li>Parent<ul><li>Child</li></ul></li><li><br></li></ul>')
    const before = root.innerHTML

    expect(repairOrphanedListItems(root)).toBe(false)
    expect(root.innerHTML).toBe(before)
  })
})

describe('marker-only list items in markdown', () => {
  it('never serializes a doubled bullet marker', () => {
    const markdown = serializeHtml(
      '<ul><li>Draak import</li><li><ul><li>Re-download the db</li><li>Re-run the import</li></ul></li></ul>',
    )

    expect(markdown).not.toMatch(/-\s+-\s/)
    expect(markdown).toContain('-   Draak import')
    expect(markdown).toContain('-   Re-download the db')
  })

  it('keeps ordered list numbering and nesting intact', () => {
    const markdown = serializeHtml(
      '<ol start="2"><li>Two<ul><li>Child</li></ul></li><li>Three</li></ol>',
    )

    expect(markdown).toContain('2.  Two')
    expect(markdown).toContain('    -   Child')
    expect(markdown).toContain('3.  Three')
  })

  it('round-trips a nested list without drifting a level deeper', () => {
    const markdown = '-   Parent\n    -   Child\n'
    const first = serializeHtml(parseMarkdown(markdown))
    const second = serializeHtml(parseMarkdown(first))

    expect(first).toBe(second)
    expect(first).toContain('-   Parent')
    expect(first).toContain('    -   Child')
  })
})
