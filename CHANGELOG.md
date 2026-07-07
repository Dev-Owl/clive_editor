# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0

TLDR: Adds a print button that opens an isolated, printable view.

### Added

- New built-in `print` toolbar action (`Printer` icon, `Ctrl+P` / `Cmd+P`) that opens the current document in an isolated print view and triggers the browser print dialog. The print view is rendered in a hidden iframe styled with the editor's CSS, so it never affects the editor content or the host page and works even when the editor is `disabled`. Like every toolbar button it can be omitted via `toolbarItems`.
- New `print()` method on the `CliveEdit` instance and `print()` on the injected `EditorContext` for programmatic access.

### Internal

- Added `src/utils/print.ts` with unit coverage plus toolbar, command, and integration tests for the new print action.

## 0.1.19

TLDR: Bug fix release focusing on code elements

### Fixed

- Blocked browser-native `Ctrl+U` underline in the WYSIWYG editor since markdown has no underline syntax and the unmanaged `<u>` tags could not round-trip between modes.
- Inline code elements bleed into the next line on enter
- Multi-line code elements as first element in a document do not allow the user to place content above them in Visual mode
- Multi-line code elements show also single line code active in Visual mode
- Multi-line code doesnt handle line breaks/enter press correctly and requires pressing enter twice
- CTRL + a in a multi-line code block selects content out of its scope
- NPM Audit fix applied

## 0.1.18

### Changed

- Fixed list creation and paste handling so existing markdown list markers are normalized instead of producing duplicated markers such as `- - Item`.
- Fixed visual-mode list Enter behavior so inline formatting like strikethrough ends with the current list item and does not automatically continue into the next item.

### Internal

- Added focused regression coverage for markdown-mode list toggling, WYSIWYG list creation and paste normalization, and Enter handling for formatted list items.

## 0.1.17

### Changed

- Fixed visual-mode inline formatting across sibling list-item selections so toolbar actions and keyboard shortcuts like `Ctrl+B` apply formatting to each selected item instead of wrapping the whole selection as a single list block.

### Internal

- Added regression coverage for sibling list-item inline formatting in the shared selection utilities.

## 0.1.16

### Changed

- Preserved intentional blank lines created in visual mode when switching to markdown mode and back by encoding them with an invisible round-trip placeholder instead of dropping them during serialization.
- Fixed visual-to-markdown whitespace serialization so repeated empty visual lines no longer turn into alternating empty lines and trailing two-space hard-break lines in markdown mode.
- Added new image size selection mode supporting pre-sets and custom sizes for images in documents

### Internal

- Added regression coverage for repeated visual blank lines in both the shared markdown serializer and the `CliveEdit` mode-switch integration flow.
- Added regression coverage for custom image width entry in the WYSIWYG image resize controls.

## 0.1.15

### Changed

- Fixed WYSIWYG table-cell editing so deleting a backward text selection keeps the caret at the actual deletion point instead of jumping to the start of the cell.
- Fixed single-cell text replacement in WYSIWYG tables so typed characters replace the selected content in place instead of being appended to the end of the cell.
- Enabled bullet and ordered list commands inside WYSIWYG table cells so selected cell content can be converted into lists directly in visual mode.
- Improved table-cell list editing so pressing `Enter` on an empty list item mirrors normal list behavior by outdenting nested items or exiting the list at the top level.
- Preserved table-cell lists when switching between visual and markdown modes by serializing them with `<br>` separators inside the cell and restoring them back into list markup on render.
- Fixed mixed bullet and numbered lists inside a single table cell so round-tripping through markdown mode no longer escapes or flattens the numbered items.

### Internal

- Added regression coverage for backward selections and in-place text replacement inside table cells.
- Added regression coverage for table-cell list creation, empty-item Enter handling, and mixed list round-tripping in markdown tables.

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
