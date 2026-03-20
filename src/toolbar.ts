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
import type { ToolbarItem } from '@/types'

export const defaultToolbarItems: ToolbarItem[] = [
  {
    id: 'bold', label: 'Bold', icon: Bold, action: 'bold',
    shortcut: 'Ctrl+B',
    active: (ctx) => ctx.isActive('strong'),
  },
  {
    id: 'italic', label: 'Italic', icon: Italic, action: 'italic',
    shortcut: 'Ctrl+I',
    active: (ctx) => ctx.isActive('em'),
  },
  {
    id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough,
    action: 'strikethrough',
    active: (ctx) => ctx.isActive('del') || ctx.isActive('s'),
  },
  {
    id: 'heading1', label: 'Heading 1', icon: Heading1, action: 'heading1',
    divider: true,
    active: (ctx) => ctx.isActive('h1'),
  },
  {
    id: 'heading2', label: 'Heading 2', icon: Heading2, action: 'heading2',
    active: (ctx) => ctx.isActive('h2'),
  },
  {
    id: 'heading3', label: 'Heading 3', icon: Heading3, action: 'heading3',
    active: (ctx) => ctx.isActive('h3'),
  },
  {
    id: 'bulletList', label: 'Bullet List', icon: List, action: 'bulletList',
    divider: true,
    active: (ctx) => ctx.isActive('ul'),
  },
  {
    id: 'orderedList', label: 'Ordered List', icon: ListOrdered, action: 'orderedList',
    active: (ctx) => ctx.isActive('ol'),
  },
  {
    id: 'indentList', label: 'Indent List', icon: IndentIncrease, action: 'indentList',
    shortcut: 'Tab',
  },
  {
    id: 'outdentList', label: 'Outdent List', icon: IndentDecrease, action: 'outdentList',
    shortcut: 'Shift+Tab',
  },
  {
    id: 'blockquote', label: 'Blockquote', icon: Quote, action: 'blockquote',
    divider: true,
    active: (ctx) => ctx.isActive('blockquote'),
  },
  {
    id: 'codeInline', label: 'Inline Code', icon: Code, action: 'codeInline',
    active: (ctx) => ctx.isActive('code'),
  },
  {
    id: 'codeBlock', label: 'Code Block', icon: CodeXml, action: 'codeBlock',
    active: (ctx) => ctx.isActive('pre'),
  },
  {
    id: 'link', label: 'Link', icon: Link, action: 'link',
    divider: true,
    shortcut: 'Ctrl+K',
    active: (ctx) => ctx.isActive('a'),
  },
  {
    id: 'image', label: 'Image', icon: Image, action: 'image',
  },
  {
    id: 'hr', label: 'Horizontal Rule', icon: Minus, action: 'horizontalRule',
  },
  {
    id: 'emoji', label: 'Emoji', icon: Smile, action: 'emoji',
  },
  {
    id: 'table', label: 'Table', icon: Table, action: 'table',
    active: (ctx) => ctx.isActive('table'),
  },
  {
    id: 'undo', label: 'Undo', icon: Undo2, action: 'undo',
    divider: true,
    shortcut: 'Ctrl+Z',
  },
  {
    id: 'redo', label: 'Redo', icon: Redo2, action: 'redo',
    shortcut: 'Ctrl+Shift+Z',
  },
]
