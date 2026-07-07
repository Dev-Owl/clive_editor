import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Focused hunt for "input silently lost" bugs: cases where content typed in the
 * WYSIWYG editor never makes it into the markdown model. The WYSIWYG → markdown
 * emit is debounced (100 ms), so anything that steals focus or changes mode
 * inside that window is a candidate for data loss.
 */

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

async function resetToVisual(page: Page) {
  await page.goto('/')

  // Clear the pre-filled README content from markdown mode first.
  const toMarkdown = page.getByRole('button', { name: /Switch to Markdown mode/i })
  if (await toMarkdown.isVisible()) {
    await toMarkdown.click()
  }
  const textarea = page.getByRole('textbox', { name: 'Markdown source editor' })
  await textarea.click()
  await textarea.press(`${mod}+A`)
  await textarea.press('Backspace')

  await page.getByRole('button', { name: /Switch to Visual mode/i }).click()
  return page.locator('.ce-wysiwyg')
}

const rawOutput = (page: Page) => page.locator('.debug__pre').first()

test.describe('input-loss hunt', () => {
  test('typing then immediately switching to markdown keeps the text', async ({ page }) => {
    const editor = await resetToVisual(page)
    await editor.click()
    await page.keyboard.type('Quick brown fox')

    // Switch immediately — inside the debounce window — no artificial wait.
    await page.getByRole('button', { name: /Switch to Markdown mode/i }).click()

    const textarea = page.getByRole('textbox', { name: 'Markdown source editor' })
    await expect(textarea).toHaveValue(/Quick brown fox/)
  })

  test('typing then blurring the editor flushes the text to markdown', async ({ page }) => {
    const editor = await resetToVisual(page)
    await editor.click()
    await page.keyboard.type('Text before blur')

    // Move focus out of the editor without waiting for the debounce.
    await page.getByRole('button', { name: /Switch to Markdown mode/i }).focus()
    await editor.evaluate((el) => (el as HTMLElement).blur())

    await expect(rawOutput(page)).toContainText('Text before blur')
  })

  test('last character is not dropped when switching modes fast', async ({ page }) => {
    const editor = await resetToVisual(page)
    await editor.click()
    // Type char-by-char, then flip modes right after the final keystroke.
    await page.keyboard.type('abcdefg')
    await page.getByRole('button', { name: /Switch to Markdown mode/i }).click()

    const textarea = page.getByRole('textbox', { name: 'Markdown source editor' })
    await expect(textarea).toHaveValue(/abcdefg/)
  })

  test('rapid multi-line typing round-trips without losing lines', async ({ page }) => {
    const editor = await resetToVisual(page)
    await editor.click()
    await page.keyboard.type('Alpha')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Beta')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Gamma')

    await page.getByRole('button', { name: /Switch to Markdown mode/i }).click()

    const textarea = page.getByRole('textbox', { name: 'Markdown source editor' })
    await expect(textarea).toHaveValue(/Alpha/)
    await expect(textarea).toHaveValue(/Beta/)
    await expect(textarea).toHaveValue(/Gamma/)
  })

  test('edits made after a mode round-trip still transfer to markdown', async ({ page }) => {
    const editor = await resetToVisual(page)
    await editor.click()
    await page.keyboard.type('First')

    // Round-trip markdown -> visual, then append more text.
    await page.getByRole('button', { name: /Switch to Markdown mode/i }).click()
    await page.getByRole('button', { name: /Switch to Visual mode/i }).click()

    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Second')

    await page.getByRole('button', { name: /Switch to Markdown mode/i }).click()
    const textarea = page.getByRole('textbox', { name: 'Markdown source editor' })
    await expect(textarea).toHaveValue(/First Second/)
  })
})
