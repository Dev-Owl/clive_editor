# Changelog

All notable changes to this project will be documented in this file.

## 0.1.14

### Changed

- Added `EditorContext.insertMarkdown(markdown)` so custom toolbar buttons can insert markdown-aware content in both modes.
- Preserved the saved visual-mode selection for custom toolbar insertions so markdown and text buttons insert at the expected caret position after a toolbar click.
- Clarified the custom toolbar API in the README with separate examples for literal text insertion and markdown insertion.
- Fixed WYSIWYG auto-format shortcut upgrades so typing `*` and immediately pressing Space still creates a bullet list reliably.
- Added an input-event fallback for line-start markdown shortcuts in visual mode to avoid missed upgrades when the DOM updates just after the Space keydown.

## 0.1.13

### Changed

- Refined toolbar action typing by introducing the exported `ToolbarAction` union type for `ToolbarItem.action`.
- Extended `ToolbarItem` so custom toolbars can define either built-in action buttons or custom buttons with their own `onClick(ctx)` handlers.
- Exported `defaultToolbarItems` to make it easier to append custom buttons to the built-in toolbar layout.
- Added `EditorContext.insertText(text)` so custom toolbar buttons can insert application-specific content in both visual and markdown modes.
- Documented the full built-in toolbar action list, including `indentList` and `outdentList`.
- Improved markdown-mode list indent/outdent behavior to match visual mode more closely:
  - list items only move one level at a time
  - indentation requires a valid previous sibling at the target level
  - nested list structure now round-trips correctly when switching back to visual mode

### Internal

- Replaced separate internal toolbar and markdown command modules with a unified internal command registry to reduce duplicated action metadata and routing logic.
- Consolidated internal action dispatch in `CliveEdit` to reduce duplicated mode-specific command wiring.
- Centralized markdown-mode command templates and insert behavior in the shared command registry without changing normal editor usage.
- Removed leftover keyboard debug logging from the editor wrapper.
