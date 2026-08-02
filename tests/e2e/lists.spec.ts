import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * List editing in the real browser: jsdom cannot reproduce contenteditable's
 * native Enter handling, which is exactly what used to split a list item and
 * move its sub-list into a marker-only item (`-   -   text`).
 */

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

const markdownBox = (page: Page) =>
  page.getByRole('textbox', { name: 'Markdown source editor' })

async function loadMarkdown(page: Page, markdown: string) {
  await page.goto('/')

  const toMarkdown = page.getByRole('button', { name: /Switch to Markdown mode/i })
  if (await toMarkdown.isVisible()) {
    await toMarkdown.click()
  }

  const textarea = markdownBox(page)
  await textarea.click()
  await textarea.press(`${mod}+A`)
  await textarea.press('Backspace')
  await textarea.fill(markdown)

  await page.getByRole('button', { name: /Switch to Visual mode/i }).click()
  return page.locator('.ce-wysiwyg')
}

/**
 * Place the caret inside the own text of the top-level item that has
 * children.  Clicking the item is not enough: its box spans the nested rows,
 * so a click lands on a child instead of the parent's own line.
 */
async function placeCaretInParentItem(page: Page, offset: number) {
  await page.locator('.ce-wysiwyg').click()
  await page.evaluate((caretOffset) => {
    const parent = Array.from(document.querySelectorAll('.ce-wysiwyg > ul > li'))
      .find((li) => li.firstChild?.textContent?.startsWith('Draak import'))
    const text = parent?.firstChild
    if (!text) throw new Error('parent list item not found')

    const range = document.createRange()
    range.setStart(text, caretOffset)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, offset)
}

/** Caret at the start of a nested item's own text. */
async function placeCaretInNestedItem(page: Page, itemText: string) {
  await page.locator('.ce-wysiwyg').click()
  await page.evaluate((text) => {
    const item = Array.from(document.querySelectorAll('.ce-wysiwyg li'))
      .find((li) => li.firstChild?.textContent?.startsWith(text))
    if (!item?.firstChild) throw new Error(`list item not found: ${text}`)

    const range = document.createRange()
    range.setStart(item.firstChild, 0)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, itemText)
}

/** The markdown model as the host app sees it — no mode switch involved. */
async function rawMarkdown(page: Page) {
  await page.waitForTimeout(200)
  return page.locator('.debug__pre').first().innerText()
}

const NESTED_LIST = [
  '-   Emails',
  '    -   See due elements',
  '-   Draak import',
  '    -   Re-download the db',
  '    -   Re-run the import',
  '',
].join('\n')

test.describe('list editing', () => {
  test('Enter at the end of an item with children starts a sibling item', async ({ page }) => {
    await loadMarkdown(page, NESTED_LIST)

    await placeCaretInParentItem(page, 'Draak import'.length)
    await page.keyboard.press('Enter')
    await page.keyboard.type('Second import')

    await page.getByRole('button', { name: /Switch to Markdown mode/i }).click()

    const markdown = await markdownBox(page).inputValue()
    expect(markdown).not.toMatch(/-\s+-\s/)
    expect(markdown).toContain('-   Draak import')
    expect(markdown).toContain('    -   Re-download the db')
    expect(markdown).toContain('    -   Re-run the import')
    expect(markdown).toContain('-   Second import')
  })

  test('Enter in the middle of an item with children keeps the children nested', async ({ page }) => {
    const editor = await loadMarkdown(page, NESTED_LIST)

    // Caret between the two words of the parent item's own text
    await placeCaretInParentItem(page, 'Draak'.length)
    await page.keyboard.press('Enter')

    await page.getByRole('button', { name: /Switch to Markdown mode/i }).click()

    const markdown = await markdownBox(page).inputValue()
    expect(markdown).not.toMatch(/-\s+-\s/)
    expect(markdown).toContain('-   Draak')
    expect(markdown).toContain('    -   Re-download the db')
    expect(markdown).toContain('-   import')
  })

  test('repeated Enter never drives the list a level deeper', async ({ page }) => {
    await loadMarkdown(page, NESTED_LIST)

    await placeCaretInParentItem(page, 'Draak import'.length)

    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Enter')
      await page.keyboard.type(`Item ${i}`)
    }

    await page.getByRole('button', { name: /Switch to Markdown mode/i }).click()

    const markdown = await markdownBox(page).inputValue()
    expect(markdown).not.toMatch(/-\s+-\s/)
    expect(markdown).toContain('-   Item 0')
    expect(markdown).toContain('-   Item 1')
    expect(markdown).toContain('-   Item 2')
  })

  test('removing an emptied bullet keeps the remaining items nested', async ({ page }) => {
    await loadMarkdown(page, NESTED_LIST)

    // Clear a sub-item's text, then remove the empty bullet
    await placeCaretInNestedItem(page, 'Re-download the db')
    for (let i = 0; i < 'Re-download the db'.length; i += 1) {
      await page.keyboard.press('Shift+ArrowRight')
    }
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')

    const markdown = await rawMarkdown(page)
    expect(markdown).not.toMatch(/-\s+-\s/)
    expect(markdown).toContain('-   Draak import')
    expect(markdown).toContain('    -   Re-run the import')
  })

  test('removing an emptied parent bullet never doubles the marker', async ({ page }) => {
    await loadMarkdown(page, NESTED_LIST)

    // This is the reported flow: wipe the item's text, then delete the bullet
    await placeCaretInParentItem(page, 0)
    for (let i = 0; i < 'Draak import'.length; i += 1) {
      await page.keyboard.press('Shift+ArrowRight')
    }
    await page.keyboard.press('Backspace')
    expect(await rawMarkdown(page)).not.toMatch(/-\s+-\s/)

    await page.keyboard.press('Backspace')
    const markdown = await rawMarkdown(page)
    expect(markdown).not.toMatch(/-\s+-\s/)
    expect(markdown).toContain('-   Re-download the db')
    expect(markdown).toContain('-   Re-run the import')
  })

  test('emptying an item does not loosen the list with a blank line', async ({ page }) => {
    await loadMarkdown(page, NESTED_LIST)

    await placeCaretInNestedItem(page, 'Re-download the db')
    for (let i = 0; i < 'Re-download the db'.length; i += 1) {
      await page.keyboard.press('Shift+ArrowRight')
    }
    await page.keyboard.press('Backspace')

    const markdown = await rawMarkdown(page)
    // A blank line — including the zero-width placeholder the serializer uses
    // for intentional ones — would split the list into two loose lists
    expect(markdown).not.toMatch(/^[\s​]+$/m)
    expect(markdown).toContain('    -   Re-run the import')
  })

  test('stored markdown with doubled markers is repaired on load', async ({ page }) => {
    const editor = await loadMarkdown(
      page,
      '-   Draak import\n-   -   Re-download the db\n    -   Re-run the import\n',
    )

    const topLevel = editor.locator('> ul > li')
    await expect(topLevel).toHaveCount(1)
    await expect(topLevel.locator('> ul > li')).toHaveText([
      'Re-download the db',
      'Re-run the import',
    ])
  })
})
