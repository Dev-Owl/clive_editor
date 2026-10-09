# Changelog

All notable changes to this project will be documented in this file.

## 0.2.5

TLDR: Security release — a crafted code block could run script in the reader's browser. Update if you render markdown written by other users. Affects 0.1.4 – 0.2.4.

### Fixed

- **Cross-site scripting through the code block language (security).** The language written after the opening fence (e.g. ` ```ts `) was put into the label's `data-lang` attribute without escaping. A fence such as ` ```"><img src=x onerror=…> ` therefore created a live element with an event handler, and the script ran as soon as the markdown was shown — in `MarkdownViewer`, in Visual mode of `CliveEdit` and in the print view, with or without syntax highlighting. The language is now escaped like every other value in the rendered HTML. Introduced in 0.1.4 with the syntax highlighter; 0.1.0 – 0.1.3 are not affected.
- **`$` in a code block language garbled highlighted output.** With a highlighter configured, the label was spliced into Shiki's HTML through a replacement string, so sequences such as `$&` or `$1` in the language were expanded instead of kept literally. The label is now inserted with a replacer function.

### Internal

- Added XSS regression tests for crafted fence info strings in `parseMarkdown` (with and without a highlighter), `MarkdownViewer` and the WYSIWYG editor.

## 0.2.4

TLDR: Bug-fix release — an emptied code block in Visual mode can be clicked into and edited again.

### Fixed

- **Emptied code block could no longer be clicked into.** Deleting the last character of a code block in Visual mode left an empty `<code>` element without a line box, so the block collapsed to its padding and the caret could not be placed inside it — the only way back was a round-trip through Markdown mode. An empty code block now keeps an invisible caret placeholder (U+200B) as its only character, so it stays clickable and typeable. The placeholder is never written to the markdown. Empty fenced blocks loaded from markdown get the same treatment.
- **Natively inserted text could pick up a zero-width space in code blocks.** Text that reaches a code block without a `keydown` (IME composition, autocorrect, mobile keyboards) could land on either side of the caret placeholder, which then ended up inside the code. Stray placeholders are now removed on input while the caret position is preserved.

### Docs

- README examples import icons from `@lucide/vue` instead of the deprecated `lucide-vue-next`.

### Internal

- New `normalizeCodeBlocks()` pass in the WYSIWYG editor, run after every render and on input. It replaces the narrower repair that only restored a `<code>` element the browser had removed.
- Added unit regression tests for deleting the last character, loading an empty fence, and stray-placeholder cleanup.

## 0.2.3

TLDR: Pure maintenance release — dependency updates and removal of deprecated APIs. No functional changes included.

### Changed

- **Icons now come from `@lucide/vue`.** `lucide-vue-next` is deprecated upstream; the icons are identical. Consumers passing their own lucide icons to `toolbarItems` can keep using either package.
- **Text insertion no longer uses `document.execCommand('insertText')`.** Emoji and custom-button text insertion in Visual mode now go through the Range API like the rest of the editor. Undo/Redo are unaffected (the editor keeps its own history).

### Internal

- Updated the toolchain: Vite 8, Vitest 5, jsdom 30, markdown-it 15, Shiki 4, plus current minor versions of Vue, vue-tsc, `@vitejs/plugin-vue`, `@vue/test-utils`, Playwright and turndown. TypeScript stays on 5.9 (vue-tsc does not support the TypeScript 7 native compiler yet).
- Dropped `@types/markdown-it` — markdown-it 15 ships its own types.
- `build.rollupOptions` → `build.rolldownOptions` (deprecated in Vite 8).
- CI now builds on Node 24 (Node 20 is end-of-life) with current major versions of the GitHub Pages actions; added `.nvmrc`.
- Tests that mocked `execCommand` now place a real caret instead.

## 0.2.2

TLDR: Adds a copy button to code blocks in the viewer, and fixes list editing — editing or pasting inside an existing list no longer corrupts its structure (`-   -   item`).

### Added

- **Copy button on code blocks in `MarkdownViewer`.** Every rendered code block gets a button that copies the block's content to the clipboard. It fades in when the block is hovered or focused, is always visible on touch devices, confirms the copy for a moment and then resets. Controlled by the new `codeCopyButton` prop (default `true`) and styled with the `--ce-code-copy-*` CSS variables. Viewer only — the editor never shows it. Clipboard writes use the async Clipboard API with a selection-based fallback for insecure origins.

### Fixed

- **Lists drifted a level deeper and grew doubled bullets (`-   -   item`).** Deleting a list item's text and then removing the empty bullet left the sub-list inside an item that has no line of its own. Markdown cannot express that: it was written as a doubled marker, which re-parsed into the very same structure, so each round-trip pushed the list another level deeper and the visual list stopped matching the document. Removing such a bullet is now handled by the editor: the sub-list goes back to the item above, or moves up a level when there is no item to attach it to. Documents that already contain doubled markers are repaired when they are loaded into Visual mode.
- **Pressing Enter in a list item that has sub-items.** The "caret at end of item" check looked at the item's last text node, which for rendered markdown is the whitespace after the nested `<ul>` — so it never matched for items with children and the browser split the item itself, moving the sub-list into a new, text-less item. Enter is now handled by the editor for every caret position in a list item: at the end it starts a sibling item below the whole sub-tree, at the start it pushes the item down, and in the middle it splits the text while the sub-items stay with the original item.
- **Emptying a list item's text inserted a blank line into the list.** The item's placeholder was serialized as an indentation-only line, which turns the surrounding list into a loose list and pushes the items apart.
- **Switching a bullet/ordered list off left its sub-items as a list.** Nested `<ul>`/`<ol>` elements were copied into the generated paragraph — invalid markup that kept rendering as a list. Sub-items now become paragraphs as well.
- **Outdenting an item that already had sub-items gave it a second sub-list.** The following siblings now join the sub-list the item already has.
- **Pasting a list into a list flattened it.** Every `<li>` at any depth was inserted as a sibling of the current item, so a copied two-level list arrived as one flat level (and left an empty `<ul>` behind, which showed up as a blank line). Pasted sub-lists now travel with their item, and indentation in plain-text markdown (spaces or tabs) is read as nesting.
- **Loose lists were rewritten and picked up an invisible character.** A list with blank lines between its items, or an item owning a second paragraph, a code block or a quote, was indented by the serializer down to a whitespace-only line, which the blank-line handling then stored as a zero-width space (U+200B) in the markdown — and the item's blocks collapsed into `<br>` breaks. Such lists now round-trip unchanged.
- **Pasting a markdown list outside a list produced escaped text.** `- item` lines pasted into an empty paragraph or an empty document stayed literal text and were written back as `\- item`. They now become a real list — ordered when the lines are numbered. Text pasted into a paragraph that already has content, into a code block, or into a table cell is still inserted verbatim.

- **Table column alignment was silently dropped.** The table sanitizer rewrote every separator row as `| --- |` before the markdown was parsed, so `| :--- | ---: |` never reached the rendered table and could not be written back. Alignment now survives parsing, is rendered, and is serialized again.
- **A `|` inside a table cell broke the table.** Cell content was never escaped on the way out and rows were split on every pipe on the way in, so a pipe typed into a cell — or an escaped `\|` in the source — added a column and shifted the rest of the row. Pipes are now escaped when writing and ignored when escaped while reading.

### Internal

- New `src/utils/lists.ts` with the shared list-structure helpers (marker-only item detection, own-content boundaries, and the repair pass) used by both the editor and the HTML→markdown serializer.
- Turndown's `listItem` rule is now overridden so a marker-only item can never emit a doubled bullet, as a safety net for transient editing states.
- Added unit regression tests for the repair pass, the serializer rule, list splitting, bullet removal and list pasting, plus an end-to-end `lists` Playwright suite that covers the flows in a real browser (jsdom cannot reproduce `contenteditable`'s native Enter/Backspace handling).
- New `roundtrip` test suite that asserts markdown → HTML → markdown is a fixed point for every supported construct. Instability is what let the list corruption accumulate: each edit writes the serialized document back, so a construct that changes on a round-trip keeps changing on every edit.

## 0.2.1

TLDR: Bug-fix release — Undo/Redo now work in Markdown mode and WYSIWYG edits are no longer at risk of being lost.

### Fixed

- **Undo/Redo buttons did nothing in Markdown mode.** The toolbar Undo/Redo buttons only worked in Visual (WYSIWYG) mode; in Markdown mode they silently no-opped while the `Ctrl+Z` / `Ctrl+Shift+Z` shortcuts still worked, an inconsistency between toolbar and keyboard. They are now dispatched directly and behave identically in both modes.
- **Possible loss of the last WYSIWYG keystrokes.** The markdown emit is debounced (100 ms); if the editor lost focus or the component unmounted within that window, the most recent edits were never serialized. Pending edits are now flushed on `blur` and before unmount.

### Changed

- Each WYSIWYG edit now serializes to markdown and pushes to the undo history exactly once. Previously every keystroke ran the (expensive) HTML→markdown serialization twice and recorded duplicate history entries, which could require two Undo presses per edit.

### Internal

- Cleared the re-highlight/input debounce timers on unmount, and cancel the pending input debounce when the DOM is serialized on demand (mode switch / toolbar action) to avoid redundant post-sync emits.
- Removed an unused `ToolbarItem` type import in `commands.ts`.
- Added unit regression tests for Markdown-mode Undo/Redo, flush-on-blur, flush-on-unmount, and single-emit-per-edit, plus an end-to-end `input-loss` Playwright suite covering fast type-then-switch, type-then-blur, and post-round-trip editing.

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
