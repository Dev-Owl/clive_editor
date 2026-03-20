import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Quote,
  Code,
  CodeXml,
  Link,
  Image,
  Minus,
  Table,
  Smile,
  Undo2,
  Redo2,
} from 'lucide-vue-next'
import type { BuiltInToolbarItem, EditorContext, ToolbarAction, ToolbarItem } from '@/types'

type ToolbarConfig = Omit<BuiltInToolbarItem, 'action'>

type MarkdownCommandSpec =
  | { kind: 'wrap'; before: string; after: string }
  | { kind: 'prefix'; value: string }
  | { kind: 'block'; value: string }
  | { kind: 'method'; name: 'indentList' | 'outdentList' }

type WysiwygCommandSpec =
  | { kind: 'method'; name: 'bold' | 'italic' | 'strikethrough' | 'bulletList' | 'orderedList' | 'indentList' | 'outdentList' | 'blockquote' | 'codeInline' | 'codeBlock' | 'link' | 'image' | 'horizontalRule' | 'table' }
  | { kind: 'heading'; level: 1 | 2 | 3 }
  | { kind: 'history'; name: 'undo' | 'redo' }

interface CommandDefinition {
  toolbar?: ToolbarConfig
  markdown?: MarkdownCommandSpec
  wysiwyg?: WysiwygCommandSpec
}

export interface MarkdownCommandTarget {
  insertSyntax: (before: string, after: string) => void
  insertBlock: (block: string) => void
  indentList: () => void
  outdentList: () => void
}

export type WysiwygCommandTarget = Pick<
  EditorContext,
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'indentList'
  | 'outdentList'
  | 'blockquote'
  | 'codeInline'
  | 'codeBlock'
  | 'link'
  | 'image'
  | 'horizontalRule'
  | 'table'
  | 'undo'
  | 'redo'
>

const commandRegistry: Record<ToolbarAction, CommandDefinition> = {
  bold: {
    toolbar: {
      id: 'bold',
      label: 'Bold',
      icon: Bold,
      shortcut: 'Ctrl+B',
      active: (ctx) => ctx.isActive('strong'),
    },
    markdown: { kind: 'wrap', before: '**', after: '**' },
    wysiwyg: { kind: 'method', name: 'bold' },
  },
  italic: {
    toolbar: {
      id: 'italic',
      label: 'Italic',
      icon: Italic,
      shortcut: 'Ctrl+I',
      active: (ctx) => ctx.isActive('em'),
    },
    markdown: { kind: 'wrap', before: '*', after: '*' },
    wysiwyg: { kind: 'method', name: 'italic' },
  },
  strikethrough: {
    toolbar: {
      id: 'strikethrough',
      label: 'Strikethrough',
      icon: Strikethrough,
      active: (ctx) => ctx.isActive('del') || ctx.isActive('s'),
    },
    markdown: { kind: 'wrap', before: '~~', after: '~~' },
    wysiwyg: { kind: 'method', name: 'strikethrough' },
  },
  heading1: {
    toolbar: {
      id: 'heading1',
      label: 'Heading 1',
      icon: Heading1,
      divider: true,
      active: (ctx) => ctx.isActive('h1'),
    },
    markdown: { kind: 'prefix', value: '# ' },
    wysiwyg: { kind: 'heading', level: 1 },
  },
  heading2: {
    toolbar: {
      id: 'heading2',
      label: 'Heading 2',
      icon: Heading2,
      active: (ctx) => ctx.isActive('h2'),
    },
    markdown: { kind: 'prefix', value: '## ' },
    wysiwyg: { kind: 'heading', level: 2 },
  },
  heading3: {
    toolbar: {
      id: 'heading3',
      label: 'Heading 3',
      icon: Heading3,
      active: (ctx) => ctx.isActive('h3'),
    },
    markdown: { kind: 'prefix', value: '### ' },
    wysiwyg: { kind: 'heading', level: 3 },
  },
  bulletList: {
    toolbar: {
      id: 'bulletList',
      label: 'Bullet List',
      icon: List,
      divider: true,
      active: (ctx) => ctx.isActive('ul'),
    },
    markdown: { kind: 'prefix', value: '- ' },
    wysiwyg: { kind: 'method', name: 'bulletList' },
  },
  orderedList: {
    toolbar: {
      id: 'orderedList',
      label: 'Ordered List',
      icon: ListOrdered,
      active: (ctx) => ctx.isActive('ol'),
    },
    markdown: { kind: 'prefix', value: '1. ' },
    wysiwyg: { kind: 'method', name: 'orderedList' },
  },
  indentList: {
    toolbar: {
      id: 'indentList',
      label: 'Indent List',
      icon: IndentIncrease,
      shortcut: 'Tab',
    },
    markdown: { kind: 'method', name: 'indentList' },
    wysiwyg: { kind: 'method', name: 'indentList' },
  },
  outdentList: {
    toolbar: {
      id: 'outdentList',
      label: 'Outdent List',
      icon: IndentDecrease,
      shortcut: 'Shift+Tab',
    },
    markdown: { kind: 'method', name: 'outdentList' },
    wysiwyg: { kind: 'method', name: 'outdentList' },
  },
  blockquote: {
    toolbar: {
      id: 'blockquote',
      label: 'Blockquote',
      icon: Quote,
      divider: true,
      active: (ctx) => ctx.isActive('blockquote'),
    },
    markdown: { kind: 'prefix', value: '> ' },
    wysiwyg: { kind: 'method', name: 'blockquote' },
  },
  codeInline: {
    toolbar: {
      id: 'codeInline',
      label: 'Inline Code',
      icon: Code,
      active: (ctx) => ctx.isActive('code'),
    },
    markdown: { kind: 'wrap', before: '`', after: '`' },
    wysiwyg: { kind: 'method', name: 'codeInline' },
  },
  codeBlock: {
    toolbar: {
      id: 'codeBlock',
      label: 'Code Block',
      icon: CodeXml,
      active: (ctx) => ctx.isActive('pre'),
    },
    markdown: { kind: 'block', value: '\n```language\n\n```\n' },
    wysiwyg: { kind: 'method', name: 'codeBlock' },
  },
  link: {
    toolbar: {
      id: 'link',
      label: 'Link',
      icon: Link,
      divider: true,
      shortcut: 'Ctrl+K',
      active: (ctx) => ctx.isActive('a'),
    },
    markdown: { kind: 'wrap', before: '[', after: '](url)' },
    wysiwyg: { kind: 'method', name: 'link' },
  },
  image: {
    toolbar: {
      id: 'image',
      label: 'Image',
      icon: Image,
    },
    markdown: { kind: 'wrap', before: '![alt](', after: ')' },
    wysiwyg: { kind: 'method', name: 'image' },
  },
  horizontalRule: {
    toolbar: {
      id: 'hr',
      label: 'Horizontal Rule',
      icon: Minus,
    },
    markdown: { kind: 'block', value: '\n---\n' },
    wysiwyg: { kind: 'method', name: 'horizontalRule' },
  },
  emoji: {
    toolbar: {
      id: 'emoji',
      label: 'Emoji',
      icon: Smile,
    },
  },
  table: {
    toolbar: {
      id: 'table',
      label: 'Table',
      icon: Table,
      active: (ctx) => ctx.isActive('table'),
    },
    markdown: {
      kind: 'block',
      value: '\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |\n',
    },
    wysiwyg: { kind: 'method', name: 'table' },
  },
  undo: {
    toolbar: {
      id: 'undo',
      label: 'Undo',
      icon: Undo2,
      divider: true,
      shortcut: 'Ctrl+Z',
    },
    wysiwyg: { kind: 'history', name: 'undo' },
  },
  redo: {
    toolbar: {
      id: 'redo',
      label: 'Redo',
      icon: Redo2,
      shortcut: 'Ctrl+Shift+Z',
    },
    wysiwyg: { kind: 'history', name: 'redo' },
  },
}

const defaultToolbarActionOrder: ToolbarAction[] = [
  'bold',
  'italic',
  'strikethrough',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'orderedList',
  'indentList',
  'outdentList',
  'blockquote',
  'codeInline',
  'codeBlock',
  'link',
  'image',
  'horizontalRule',
  'emoji',
  'table',
  'undo',
  'redo',
]

export const defaultToolbarItems: BuiltInToolbarItem[] = defaultToolbarActionOrder.map((action) => {
  const toolbar = commandRegistry[action].toolbar
  if (!toolbar) {
    throw new Error(`Toolbar metadata missing for action "${action}"`)
  }

  return {
    ...toolbar,
    action,
  }
})

export function getHeadingAction(level: 1 | 2 | 3): Extract<ToolbarAction, 'heading1' | 'heading2' | 'heading3'> {
  return `heading${level}` as Extract<ToolbarAction, 'heading1' | 'heading2' | 'heading3'>
}

export function runMarkdownCommand(target: MarkdownCommandTarget, action: ToolbarAction): boolean {
  const spec = commandRegistry[action].markdown
  if (!spec) return false

  switch (spec.kind) {
    case 'wrap':
      target.insertSyntax(spec.before, spec.after)
      return true
    case 'prefix':
      target.insertSyntax(spec.value, '')
      return true
    case 'block':
      target.insertBlock(spec.value)
      return true
    case 'method':
      target[spec.name]()
      return true
  }
}

export function runWysiwygCommand(target: WysiwygCommandTarget, action: ToolbarAction): boolean {
  const spec = commandRegistry[action].wysiwyg
  if (!spec) return false

  switch (spec.kind) {
    case 'method':
      target[spec.name]()
      return true
    case 'heading':
      target.heading(spec.level)
      return true
    case 'history':
      target[spec.name]()
      return true
  }
}
