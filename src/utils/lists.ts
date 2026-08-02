/* ================================================================== */
/*  lists.ts — list structure helpers shared by the editor & serializer */
/* ================================================================== */

/*
 * A list item that carries no content of its own but wraps a nested list
 * (`<li><ul>…</ul></li>`) cannot be expressed in markdown: it serializes to
 * a doubled marker (`-   -   item`) which re-parses into the very same
 * structure, so the damage sticks and the visual list drifts a level deeper
 * on every round-trip.
 *
 * Browsers create such items whenever they split a list item that has a
 * sub-list — the sub-list ends up in the new, text-less item.  These helpers
 * detect and repair that structure.
 */

const ELEMENT_NODE = 1
const TEXT_NODE = 3

/** Minimal structural view of a DOM node — Turndown runs on its own DOM. */
interface ListNode {
  nodeType: number
  nodeName: string
  textContent: string | null
  childNodes: ArrayLike<ListNode>
}

export function isListElement(node: unknown): boolean {
  const candidate = node as ListNode | null
  if (!candidate || candidate.nodeType !== ELEMENT_NODE) return false
  return candidate.nodeName === 'UL' || candidate.nodeName === 'OL'
}

/**
 * True when `node` is an `<li>` whose only content is one or more nested
 * lists — i.e. a list item without a line of its own.
 */
export function isListWrapperOnlyItem(node: unknown): boolean {
  const candidate = node as ListNode | null
  if (!candidate || candidate.nodeType !== ELEMENT_NODE || candidate.nodeName !== 'LI') {
    return false
  }

  let hasNestedList = false

  for (const child of Array.from(candidate.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      if (child.textContent?.trim()) return false
      continue
    }
    if (child.nodeType !== ELEMENT_NODE) continue

    if (isListElement(child)) {
      hasNestedList = true
      continue
    }
    // <br> placeholders don't count as content, anything else does
    if (child.nodeName === 'BR') continue
    return false
  }

  return hasNestedList
}

/** True when the `<li>` has content of its own (ignoring nested lists). */
export function listItemHasOwnContent(listItem: Element): boolean {
  for (const child of Array.from(listItem.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      if (child.textContent?.trim()) return true
      continue
    }
    if (child.nodeType !== ELEMENT_NODE) continue

    const element = child as Element
    if (isListElement(element)) continue
    if (element.tagName === 'BR') continue
    return true
  }
  return false
}

/** Index of the first nested list child — the end of the item's own content. */
export function getListItemOwnContentEnd(listItem: Element): number {
  const children = Array.from(listItem.childNodes)
  const firstListIndex = children.findIndex((child) => isListElement(child))
  return firstListIndex === -1 ? children.length : firstListIndex
}

/**
 * True when the item holds a `<br>` placeholder of its own — an item whose
 * text was just deleted.  Markdown cannot express it (the empty marker is
 * dropped on re-parse), so it is serialized like a marker-only item, but the
 * DOM keeps it: the user is most likely about to type the text again.
 */
function hasBreakPlaceholder(listItem: Element): boolean {
  return Array.from(listItem.childNodes)
    .slice(0, getListItemOwnContentEnd(listItem))
    .some((child) => child.nodeType === ELEMENT_NODE && (child as Element).tagName === 'BR')
}

interface RepairOptions {
  /**
   * Nodes that must not be touched — typically the current selection.
   * A marker-only item containing one of them is left alone so repairs never
   * yank content away while the user is still editing that item.
   */
  protectedNodes?: (Node | null | undefined)[]
}

/**
 * Repair marker-only list items inside `root`, and drop lists left without
 * any items.
 *
 * The nested items are merged back into the preceding sibling item (where
 * they belonged before the item was split), or lifted one level when there
 * is no preceding item to attach them to.
 *
 * Returns `true` when the DOM was modified.
 */
export function repairOrphanedListItems(root: Element | null, options?: RepairOptions): boolean {
  if (!root) return false

  const protectedNodes = (options?.protectedNodes ?? []).filter((node): node is Node => !!node)
  let changed = false

  // An item-less list renders as nothing but still serializes to a blank line
  for (const list of Array.from(root.querySelectorAll('ul, ol'))) {
    if (list.querySelector('li')) continue
    if (protectedNodes.some((node) => list === node || list.contains(node))) continue
    list.remove()
    changed = true
  }

  // Deepest item first, so a repaired inner list is already sane by the time
  // its ancestors are inspected.
  const items = Array.from(root.querySelectorAll('li')).reverse()

  for (const listItem of items) {
    // The item may have been removed by an earlier repair in this pass
    if (!listItem.parentElement) continue
    if (!isListWrapperOnlyItem(listItem)) continue
    if (hasBreakPlaceholder(listItem)) continue
    if (protectedNodes.some((node) => listItem === node || listItem.contains(node))) continue

    const nestedLists = Array.from(listItem.children).filter((child) => isListElement(child))
    const previousItem = listItem.previousElementSibling
    const parentList = listItem.parentElement

    if (previousItem?.tagName === 'LI') {
      // Re-attach the nested items to the item they were split away from
      for (const nested of nestedLists) {
        const existing = previousItem.querySelector(':scope > ul, :scope > ol')
        if (existing && existing.tagName === nested.tagName) {
          while (nested.firstChild) existing.appendChild(nested.firstChild)
          nested.remove()
        } else {
          previousItem.appendChild(nested)
        }
      }
    } else if (parentList) {
      // Nothing to attach to → lift the nested items one level up
      for (const nested of nestedLists) {
        while (nested.firstChild) parentList.insertBefore(nested.firstChild, listItem)
        nested.remove()
      }
    } else {
      continue
    }

    listItem.remove()
    changed = true
  }

  return changed
}
