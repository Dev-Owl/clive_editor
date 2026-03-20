# Changelog

All notable changes to this project will be documented in this file.

## 0.1.13

### Changed

- Refined toolbar action typing by introducing the exported `ToolbarAction` union type for `ToolbarItem.action`.
- Documented the full built-in toolbar action list, including `indentList` and `outdentList`.
- Improved markdown-mode list indent/outdent behavior to match visual mode more closely:
  - list items only move one level at a time
  - indentation requires a valid previous sibling at the target level
  - nested list structure now round-trips correctly when switching back to visual mode
