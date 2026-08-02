import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Wait until the rendered markup stops changing between two polls. */
async function settle(page: Page) {
  const content = page.locator('.ce-viewer__content')
  let previous: string | null = null

  await expect(async () => {
    const current = await content.innerHTML()
    const unchanged = previous !== null && current === previous
    // Record before asserting — a throw here must not lose the snapshot
    previous = current
    expect(unchanged, 'rendered markup still changing').toBe(true)
  }).toPass({ timeout: 5000 })
}

/**
 * The copy button is injected into `v-html` markup and handled by a delegated
 * listener, so only a real browser exercises the full path — including the
 * clipboard write itself.
 */
test.describe('code block copy button', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('copies the code block content to the clipboard', async ({ page }) => {
    await page.goto('/')

    const viewer = page.locator('.ce-viewer__content')
    const codeBlock = viewer.locator('pre').first()
    await expect(codeBlock).toBeVisible()
    // The editor emits its normalized markdown once after mounting, which
    // re-renders the viewer — interacting before that detaches the element
    await settle(page)

    const expected = await codeBlock.locator('code').innerText()

    await codeBlock.hover()
    const button = codeBlock.locator('.ce-code-copy')
    await expect(button).toBeVisible()
    await button.click()

    // The button confirms the copy, then resets
    await expect(button).toHaveClass(/is-copied/)
    await expect(button).toHaveAttribute('aria-label', 'Copied')

    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard.trim()).toBe(expected.trim())

    await expect(button).not.toHaveClass(/is-copied/, { timeout: 5000 })
  })

  test('the editor itself never shows a copy button', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('.ce-viewer__content .ce-code-copy').first()).toBeAttached()
    await expect(page.locator('.ce-wysiwyg .ce-code-copy')).toHaveCount(0)
  })
})
