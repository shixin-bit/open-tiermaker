import { test, expect, type Page } from '@playwright/test'
import * as path from 'node:path'

const FIXTURE_PNG = path.resolve(process.cwd(), 'e2e/fixtures/test.png')

// 未登录 session 直接返回未认证，避免触发登录 Modal
function mockGuest(page: Page) {
  page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
  })
  page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ status: 401, json: { message: 'No refresh token' } })
  })
}

// 关闭自动弹出的登录 Modal(整页加载后 session 返回 401 会触发)
async function dismissAuthModal(page: Page) {
  const closeButton = page.getByRole('button', { name: '关闭', exact: true })
  await expect(closeButton).toBeVisible({ timeout: 10000 })
  await closeButton.click()
  await expect(closeButton).toBeHidden()
}

test.describe('编辑体验 - 主题切换与持久化', () => {
  test.beforeEach(async ({ page }) => {
    mockGuest(page)
    await page.goto('/boards/local/e2e-editing')
    await dismissAuthModal(page)
  })

  test('切到深色主题 → 刷新页面保持深色', async ({ page }) => {
    const darkButton = page.getByRole('button', { name: '切换到深色主题' })
    await expect(darkButton).toBeVisible()
    await darkButton.click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    const stored = await page.evaluate(() => localStorage.getItem('open-tiermaker-theme'))
    expect(stored).toBe('dark')

    await page.reload()
    await dismissAuthModal(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('切到浅色主题 → 刷新页面保持浅色', async ({ page }) => {
    // 先切到深色,再切回浅色,验证初始状态切换路径
    const darkButton = page.getByRole('button', { name: '切换到深色主题' })
    await darkButton.click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    const lightButton = page.getByRole('button', { name: '切换到浅色主题' })
    await lightButton.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.reload()
    await dismissAuthModal(page)
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    const stored = await page.evaluate(() => localStorage.getItem('open-tiermaker-theme'))
    expect(stored).toBe('light')
  })

  test('切到跟随系统主题 - 默认无 dark class', async ({ page }) => {
    const systemButton = page.getByRole('button', { name: '切换到跟随系统主题' })
    await systemButton.click()
    // Playwright 默认无 prefers-color-scheme 模拟,系统视为浅色
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    const stored = await page.evaluate(() => localStorage.getItem('open-tiermaker-theme'))
    expect(stored).toBe('system')
  })
})

test.describe('编辑体验 - 上传图片 + Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    mockGuest(page)
    await page.goto('/boards/local/e2e-editing')
    await dismissAuthModal(page)
  })

  test('上传图片 → 触发 Undo → 回退添加 → Redo → 恢复', async ({ page }) => {
    // 上传图片
    const fileInput = page.locator('input[type="file"]').first()
    await expect(fileInput).toBeAttached()
    await fileInput.setInputFiles(FIXTURE_PNG)

    // 图片应出现在图片池
    const poolImage = page.locator('[data-image-id]').first()
    await expect(poolImage).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-image-id]')).toHaveCount(1)

    // Ctrl+Z 回退 - 应移除刚上传的图片(image-add 历史)
    await page.keyboard.press('Control+z')
    await expect(page.locator('[data-image-id]')).toHaveCount(0)

    // Ctrl+Shift+Z 重做 - 图片应恢复
    await page.keyboard.press('Control+Shift+Z')
    await expect(page.locator('[data-image-id]')).toHaveCount(1)

    // 再用 Ctrl+Y 测试 redo 兼容键
    await page.keyboard.press('Control+z')
    await expect(page.locator('[data-image-id]')).toHaveCount(0)
    await page.keyboard.press('Control+y')
    await expect(page.locator('[data-image-id]')).toHaveCount(1)
  })
})

test.describe('编辑体验 - Tier label 编辑 + Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    mockGuest(page)
    await page.goto('/boards/local/e2e-editing')
    await dismissAuthModal(page)
  })

  test('双击改 S 等级 label → Undo → 回退', async ({ page }) => {
    // 找到 S 等级 label(默认值 "S")
    const sLabel = page.getByText('S', { exact: true }).first()
    await sLabel.waitFor()

    // 双击进入编辑模式
    await sLabel.dblclick()

    // 编辑输入框应该出现
    const editInput = page.locator('input.text-center.font-bold')
    await expect(editInput).toBeVisible()

    // 清空后输入新值
    await editInput.fill('SS')
    await editInput.press('Enter')

    // 验证 label 已更新
    await expect(page.getByText('SS', { exact: true })).toBeVisible()

    // Ctrl+Z 回退 label 修改(tier-label 历史)
    await page.keyboard.press('Control+z')
    await expect(page.getByText('S', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('SS', { exact: true })).toHaveCount(0)

    // Ctrl+Shift+Z 重做
    await page.keyboard.press('Control+Shift+Z')
    await expect(page.getByText('SS', { exact: true })).toBeVisible()
  })
})
