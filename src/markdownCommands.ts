import type { ToolbarAction } from '@/types'

export interface MarkdownCommandTarget {
  insertSyntax: (before: string, after: string) => void
  insertBlock: (block: string) => void
  indentList: () => void
  outdentList: () => void
}

const MARKDOWN_WRAP_SYNTAX = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strikethrough: ['~~', '~~'],
  codeInline: ['`', '`'],
  link: ['[', '](url)'],
  image: ['![alt](', ')'],
} as const satisfies Partial<Record<ToolbarAction, readonly [string, string]>>

const MARKDOWN_PREFIX_SYNTAX = {
  heading1: '# ',
  heading2: '## ',
  heading3: '### ',
  bulletList: '- ',
  orderedList: '1. ',
  blockquote: '> ',
} as const satisfies Partial<Record<ToolbarAction, string>>

const MARKDOWN_BLOCK_TEMPLATES = {
  codeBlock: '\n```language\n\n```\n',
  horizontalRule: '\n---\n',
  table: '\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |\n',
} as const satisfies Partial<Record<ToolbarAction, string>>

export function runMarkdownCommand(
  target: MarkdownCommandTarget,
  action: ToolbarAction,
): boolean {
  if (action in MARKDOWN_WRAP_SYNTAX) {
    const [before, after] = MARKDOWN_WRAP_SYNTAX[action as keyof typeof MARKDOWN_WRAP_SYNTAX]
    target.insertSyntax(before, after)
    return true
  }

  if (action in MARKDOWN_PREFIX_SYNTAX) {
    target.insertSyntax(MARKDOWN_PREFIX_SYNTAX[action as keyof typeof MARKDOWN_PREFIX_SYNTAX], '')
    return true
  }

  if (action in MARKDOWN_BLOCK_TEMPLATES) {
    target.insertBlock(MARKDOWN_BLOCK_TEMPLATES[action as keyof typeof MARKDOWN_BLOCK_TEMPLATES])
    return true
  }

  switch (action) {
    case 'indentList':
      target.indentList()
      return true
    case 'outdentList':
      target.outdentList()
      return true
    default:
      return false
  }
}
