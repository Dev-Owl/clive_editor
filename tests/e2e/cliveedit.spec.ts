import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function clearMarkdownEditor(page: Page) {
  const toMarkdown = page.getByRole('button', { name: /Switch to Markdown mode/i })
  if (await toMarkdown.isVisible()) {
    await toMarkdown.click()
  }

  const textarea = page.getByRole('textbox', { name: 'Markdown source editor' })
  await textarea.click()
  await textarea.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await textarea.press('Backspace')
  return textarea
}

test.describe('CliveEdit playground', () => {
  test('custom toolbar button inserts the current date and time', async ({ page }) => {
    await page.goto('/')

    const textarea = await clearMarkdownEditor(page)
    const output = page.locator('.debug__pre').first()
    const before = await output.textContent()

    await page.getByRole('button', { name: 'Insert Date/Time' }).click()

    await expect(output).not.toHaveText(before ?? '')
    await expect(textarea).not.toHaveValue('')
  })

  test('markdown indent survives the switch back to visual mode', async ({ page }) => {
    await page.goto('/')

    const textarea = await clearMarkdownEditor(page)
    await textarea.fill('- Parent\n- Child')
    await textarea.press('ArrowUp')
    await textarea.press('End')
    await textarea.press('ArrowDown')

    await page.getByRole('button', { name: 'Indent List' }).click()
    await page.getByRole('button', { name: /Switch to Visual mode/i }).click()

    await expect(page.locator('.ce-wysiwyg ul > li > ul > li')).toHaveText('Child')
  })

  test('visual bold formatting updates the raw markdown output', async ({ page }) => {
    await page.goto('/')

    const textarea = await clearMarkdownEditor(page)
    await textarea.fill('Hello')
    await page.getByRole('button', { name: /Switch to Visual mode/i }).click()

    const editor = page.locator('.ce-wysiwyg')
    await editor.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.getByRole('button', { name: 'Bold' }).click()

    await expect(page.locator('.debug__pre').first()).toContainText('**Hello**')
  })
})
