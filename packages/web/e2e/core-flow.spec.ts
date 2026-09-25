import { test, expect, type Page } from '@playwright/test'

const API_BASE = 'http://localhost:5173/api'
const SHARE_ID = 'shabcdef'
const ACCESS_TOKEN = 'fake-access'
const REFRESH_TOKEN = 'fake-refresh'

function mockApi(page: Page) {
  const user = { id: 'u-1', email: 'e2e@test.com', username: 'e2e-user' }
  const boardId = 'b-1'

  // 真实架构：access token 仅存内存（整页跳转后丢失），
  // refresh token 由 HttpOnly Cookie 管理；这里用 authenticated 标志模拟 cookie 状态
  const state = {
    authenticated: false,
    visibility: 'private' as 'private' | 'public' | 'unlisted',
    boardShareId: null as string | null,
    hasSharePassword: false,
  }

  page.route(`${API_BASE}/auth/register`, async (route) => {
    state.authenticated = true
    await route.fulfill({
      status: 201,
      json: { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN, user },
    })
  })

  page.route(`${API_BASE}/auth/login`, async (route) => {
    state.authenticated = true
    await route.fulfill({
      status: 200,
      json: { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN, user },
    })
  })

  page.route(`${API_BASE}/auth/logout`, async (route) => {
    state.authenticated = false
    await route.fulfill({ status: 204, body: '' })
  })

  // 模拟 cookie 刷新：已登录时换取新的内存 access token，未登录返回 401
  page.route(`${API_BASE}/auth/refresh`, async (route) => {
    if (state.authenticated) {
      await route.fulfill({ status: 200, json: { accessToken: ACCESS_TOKEN, user } })
    } else {
      await route.fulfill({ status: 401, json: { message: 'No refresh token' } })
    }
  })

  page.route(`${API_BASE}/auth/session`, async (route) => {
    const auth = route.request().headers().authorization ?? ''
    if (auth === `Bearer ${ACCESS_TOKEN}`) {
      await route.fulfill({ status: 200, json: { user } })
    } else {
      // 与后端一致：严格 JwtAuthGuard，无有效 access token 返回 401
      await route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    }
  })

  page.route(`${API_BASE}/boards`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        json: [
          {
            id: boardId,
            title: '我的排行榜',
            description: '测试描述',
            visibility: state.visibility,
            shareId: state.boardShareId,
            hasSharePassword: state.hasSharePassword,
            _count: { items: 0 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        json: {
          id: boardId,
          title: '新建排行榜',
          description: null,
          visibility: 'private',
          shareId: null,
          hasSharePassword: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    }
  })

  page.route(`${API_BASE}/boards/${boardId}`, async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        json: {
          id: boardId,
          title: '我的排行榜',
          description: '测试描述',
          visibility: state.visibility,
          shareId: state.boardShareId,
          hasSharePassword: state.hasSharePassword,
          tiers: [
            { id: 't1', label: 'S', color: '#FF4D4F', imageIds: ['img-1'] },
            { id: 't2', label: 'A', color: '#FA8C16', imageIds: [] },
            { id: 't3', label: 'B', color: '#FAAD14', imageIds: [] },
            { id: 't4', label: 'C', color: '#A0D911', imageIds: [] },
            { id: 't5', label: 'D', color: '#1890FF', imageIds: [] },
          ],
          items: [],
          images: {
            'img-1': {
              id: 'img-1',
              src: '/api/boards/b-1/images/img-1',
              source: 'local',
              createdAt: Date.now(),
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    } else if (method === 'PUT') {
      try {
        const body = JSON.parse(route.request().postData() ?? '{}')
        if (body.visibility) state.visibility = body.visibility
        if (body.sharePassword !== undefined) {
          state.hasSharePassword = body.sharePassword !== null
        }
      } catch {
        // ignore parse errors
      }
      if (state.visibility !== 'private' && !state.boardShareId) {
        state.boardShareId = SHARE_ID
      } else if (state.visibility === 'private') {
        state.boardShareId = null
      }
      await route.fulfill({ status: 200, json: { ok: true } })
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
    }
  })

  page.route(`${API_BASE}/boards/${boardId}/content`, async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 200, json: { ok: true } })
    }
  })

  page.route(`${API_BASE}/boards/${boardId}/share`, async (route) => {
    if (route.request().method() === 'POST') {
      state.boardShareId = SHARE_ID
      state.visibility = 'public'
      await route.fulfill({ status: 200, json: { id: boardId, shareId: SHARE_ID } })
    }
  })

  page.route(`${API_BASE}/boards/${boardId}/images/*`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(8) })
  })

  page.route(`${API_BASE}/share/${SHARE_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        id: boardId,
        title: '分享的排行榜',
        description: null,
        visibility: 'public',
        shareId: SHARE_ID,
        hasSharePassword: false,
        tiers: [
          { id: 't1', label: 'S', color: '#FF4D4F', imageIds: [] },
          { id: 't2', label: 'A', color: '#FA8C16', imageIds: [] },
          { id: 't3', label: 'B', color: '#FAAD14', imageIds: [] },
          { id: 't4', label: 'C', color: '#A0D911', imageIds: [] },
          { id: 't5', label: 'D', color: '#1890FF', imageIds: [] },
        ],
        items: [],
        images: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  })

  page.route(`${API_BASE}/share/${SHARE_ID}/images/*`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(8) })
  })
}

test.describe('核心流程', () => {
  // 未登录整页加载时：session 返回 401 → cookie refresh 也返回 401，
  // 客户端会自动弹出登录 Modal；继续操作页面前先关闭它
  async function dismissAuthModal(page: Page) {
    const closeButton = page.getByRole('button', { name: '关闭', exact: true })
    await expect(closeButton).toBeVisible({ timeout: 10000 })
    await closeButton.click()
    await expect(closeButton).toBeHidden()
  }

  test('注册 → 登录 → 创建 → 保存 → 分享 → 匿名访问', async ({ page }) => {
    mockApi(page)

    await page.goto('/')
    await expect(page).toHaveTitle(/Open TierMaker/)
    await dismissAuthModal(page)

    await page
      .getByRole('link', { name: /免费注册/i })
      .first()
      .click()
    await expect(page).toHaveURL(/register/)

    await page.getByLabel('邮箱').fill('e2e@test.com')
    await page.getByLabel('用户名（可选）').fill('e2e-user')
    await page.locator('#password').fill('secret123')
    await page.locator('#confirm').fill('secret123')
    await page.getByRole('button', { name: '注册' }).click()
    await expect(page).toHaveURL(/boards/, { timeout: 5000 })

    await expect(page.getByRole('button', { name: '登出' })).toBeVisible()

    // 整页跳转后内存 access token 丢失，需等待 cookie 刷新恢复登录态后再操作
    await page.goto('/boards/new')
    await expect(page).toHaveURL(/boards\/new/)
    await page.getByPlaceholder(/例如.*排行/).fill('E2E 排行榜')
    const createButton = page.getByRole('button', { name: /创建云端排行榜/i })
    await expect(createButton).toBeVisible({ timeout: 10000 })
    await createButton.click()
    await expect(page).toHaveURL(/boards\/b-1/, { timeout: 5000 })

    await page.getByText('🔗').first().waitFor()
    await page.getByRole('button', { name: /公开/i }).first().click()
    await expect(page.getByText('分享链接')).toBeVisible()

    const copyBtn = page.getByRole('button', { name: /复制/i }).first()
    await expect(copyBtn).toBeVisible()

    await page.getByRole('link', { name: /←/i }).click()
    await expect(page).toHaveURL(/boards$/, { timeout: 5000 })
    await page.getByRole('button', { name: '登出' }).click()
    await page.goto(`/share/${SHARE_ID}`)
    await expect(page.getByText('只读分享视图')).toBeVisible()
    await expect(page.getByText('分享的排行榜')).toBeVisible()
  })

  test('未登录点击分享触发登录 Modal', async ({ page }) => {
    mockApi(page)
    await page.goto('/')
    await dismissAuthModal(page)
    await page.goto('/boards/local/local-board-id')
    await dismissAuthModal(page)

    const shareArea = page.getByRole('button', { name: /登录后开启分享能力/i }).first()
    await expect(shareArea).toBeVisible()
    await shareArea.click()

    // 用户手动触发（force）即使此前关闭过自动弹窗，也必须再次弹出
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
    await expect(page.getByRole('link', { name: '立即注册' })).toBeVisible()
  })
})
