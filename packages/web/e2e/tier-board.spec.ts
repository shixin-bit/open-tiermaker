import { test, expect, type Page } from '@playwright/test'

function mockGuest(page: Page) {
  page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ status: 200, json: { user: null } })
  })
}

test.describe('Tier Board', () => {
  test.beforeEach(async ({ page }) => {
    mockGuest(page)
    await page.goto('/boards/local/e2e-test')
  })

  test('should display five default tier rows', async ({ page }) => {
    const rows = page.locator('.flex.border.border-border.rounded-md.overflow-hidden')
    await expect(rows).toHaveCount(5)
  })

  test('should display tier labels with correct text at row start', async ({ page }) => {
    const tierRowLabels = page.locator('div.w-28.shrink-0')
    await expect(tierRowLabels).toHaveCount(5)
    const expected = ['S', 'A', 'B', 'C', 'D']
    for (let i = 0; i < 5; i++) {
      await expect(tierRowLabels.nth(i)).toContainText(expected[i])
    }
  })

  test('should display tier rows with theme color backgrounds', async ({ page }) => {
    const rows = page.locator('.flex.border.border-border.rounded-md.overflow-hidden')
    await expect(rows).toHaveCount(5)
    const expectedColors = [
      'rgba(239, 68, 68, 0.08)',
      'rgba(249, 115, 22, 0.08)',
      'rgba(234, 179, 8, 0.08)',
      'rgba(34, 197, 94, 0.08)',
      'rgba(59, 130, 246, 0.08)',
    ]
    for (let i = 0; i < 5; i++) {
      await expect(rows.nth(i)).toHaveCSS('background-color', expectedColors[i])
    }
  })

  test('should show empty state hint in every tier row', async ({ page }) => {
    const hints = page.getByText('拖拽图片到这里')
    await expect(hints).toHaveCount(5)
  })
})
