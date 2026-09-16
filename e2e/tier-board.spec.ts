import { test, expect } from '@playwright/test'

test.describe('Tier Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display five default tier rows', async ({ page }) => {
    const rows = page.locator('.flex.border.border-border.rounded-md.overflow-hidden')
    await expect(rows).toHaveCount(5)
  })

  test('should display tier labels with correct text at row start', async ({ page }) => {
    const tierRowLabels = page.locator('div.w-28.shrink-0')
    await expect(tierRowLabels).toHaveCount(5)
    await expect(tierRowLabels.nth(0)).toHaveText('S')
    await expect(tierRowLabels.nth(1)).toHaveText('A')
    await expect(tierRowLabels.nth(2)).toHaveText('B')
    await expect(tierRowLabels.nth(3)).toHaveText('C')
    await expect(tierRowLabels.nth(4)).toHaveText('D')
  })

  test('should display tier rows with theme color backgrounds', async ({ page }) => {
    const rows = page.locator('.flex.border.border-border.rounded-md.overflow-hidden')
    await expect(rows).toHaveCount(5)

    const bgColors = [
      'rgba(239, 68, 68, 0.08)',
      'rgba(249, 115, 22, 0.08)',
      'rgba(234, 179, 8, 0.08)',
      'rgba(34, 197, 94, 0.08)',
      'rgba(59, 130, 246, 0.08)',
    ]
    for (let i = 0; i < 5; i++) {
      await expect(rows.nth(i)).toHaveCSS('background-color', bgColors[i])
    }
  })

  test('should show generic empty state hint in every row', async ({ page }) => {
    const hints = page.locator('text=拖拽图片到这里')
    await expect(hints).toHaveCount(5)
  })

  test('should add image via URL input and persist', async ({ page }) => {
    const pngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const urlInput = page.getByPlaceholder('粘贴图片 URL...')
    await urlInput.fill(pngDataUrl)

    const addBtn = page.getByRole('button', { name: '添加' }).last()
    await addBtn.click()

    await expect(page.locator('img')).toHaveCount(1, { timeout: 10000 })

    await page.reload()

    await expect(page.locator('img')).toHaveCount(1)
  })
})
