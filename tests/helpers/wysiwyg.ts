import type { VueWrapper } from '@vue/test-utils'

export function setCollapsedSelection(node: Node, offset = 0) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export function setSelection(startNode: Node, startOffset: number, endNode = startNode, endOffset = startOffset) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export function setBackwardSelection(anchorNode: Node, anchorOffset: number, focusNode = anchorNode, focusOffset = anchorOffset) {
  const selection = window.getSelection()
  if (!selection) return

  selection.removeAllRanges()
  selection.collapse(anchorNode, anchorOffset)
  selection.extend(focusNode, focusOffset)
}

export function triggerPaste(
  wrapper: VueWrapper,
  {
    html = '',
    text = '',
  }: {
    html?: string
    text?: string
  },
) {
  return wrapper.get('.ce-wysiwyg').trigger('paste', {
    clipboardData: {
      files: [],
      getData: (type: string) => {
        if (type === 'text/html') return html
        if (type === 'text/plain') return text
        return ''
      },
    },
  })
}
