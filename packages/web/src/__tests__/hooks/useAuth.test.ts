import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/hooks/useAuth'
import { clearTokens } from '@/lib/tokens'

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()

vi.mock('@/lib/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
  },
  ApiError: class extends Error {
    status: number
    data: unknown
    constructor(status: number, data: unknown) {
      super((data as { message?: string })?.message ?? `HTTP ${status}`)
      this.status = status
      this.data = data
    }
  },
}))

const mockSetTokens = vi.fn()
const mockClearTokens = vi.fn()
vi.mock('@/lib/tokens', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('@/lib/tokens')
  return {
    ...actual,
    setTokens: (...args: unknown[]) => mockSetTokens(...args),
    clearTokens: (...args: unknown[]) => mockClearTokens(...args),
  }
})

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    email: 'test@example.com',
    username: 'tester',
    avatarUrl: null,
    ...overrides,
  }
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTokens()
    mockApiGet.mockReset()
    mockApiPost.mockReset()
  })

  describe('初始状态 / fetchSession', () => {
    it('初始 loading 为 true', () => {
      mockApiGet.mockResolvedValue({ user: null })
      const { result } = renderHook(() => useAuth())
      expect(result.current.loading).toBe(true)
    })

    it('session 返回 user 时标记已登录', async () => {
      const user = makeUser()
      mockApiGet.mockResolvedValue({ user })
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.user).toEqual(user)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('session 返回 user: null 时标记未登录', async () => {
      mockApiGet.mockResolvedValue({ user: null })
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('session 请求失败时降级为未登录', async () => {
      mockApiGet.mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('login', () => {
    it('成功后写入 token 并更新状态', async () => {
      mockApiPost.mockResolvedValue({
        accessToken: 'at-1',
        refreshToken: 'rt-1',
        user: makeUser({ email: 'e@test.com' }),
      })

      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.login('e@test.com', 'secret')
      })

      expect(mockApiPost).toHaveBeenCalledWith('/auth/login', {
        email: 'e@test.com',
        password: 'secret',
      })
      expect(mockSetTokens).toHaveBeenCalledWith('at-1', 'rt-1')
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.email).toBe('e@test.com')
    })

    it('失败时抛出异常', async () => {
      mockApiPost.mockRejectedValue(new Error('401'))
      const { result } = renderHook(() => useAuth())

      await expect(
        act(async () => {
          await result.current.login('bad', 'wrong')
        }),
      ).rejects.toThrow()
    })
  })

  describe('register', () => {
    it('成功后写入 token 并更新状态', async () => {
      mockApiPost.mockResolvedValue({
        accessToken: 'at-2',
        refreshToken: 'rt-2',
        user: makeUser({ username: 'newbie' }),
      })

      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.register('new@test.com', 'pw', 'newbie')
      })

      expect(mockApiPost).toHaveBeenCalledWith('/auth/register', {
        email: 'new@test.com',
        password: 'pw',
        username: 'newbie',
      })
      expect(mockSetTokens).toHaveBeenCalledWith('at-2', 'rt-2')
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('logout', () => {
    it('有 refresh token 时通知后端并清 token', async () => {
      localStorage.setItem('otm:refresh', 'rt-existing')
      mockApiPost.mockResolvedValue(null)
      mockApiGet.mockResolvedValue({ user: null })

      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.logout()
      })

      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/logout',
        { refreshToken: 'rt-existing' },
        expect.objectContaining({ skipRefresh: true, auth: false }),
      )
      expect(mockClearTokens).toHaveBeenCalled()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    it('没有 refresh token 时跳过后端调用', async () => {
      mockApiGet.mockResolvedValue({ user: null })

      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.logout()
      })

      expect(mockApiPost).not.toHaveBeenCalledWith('/auth/logout', expect.anything())
      expect(mockClearTokens).toHaveBeenCalled()
    })

    it('后端 logout 失败时仍然清 token（best effort）', async () => {
      localStorage.setItem('otm:refresh', 'rt')
      mockApiPost.mockRejectedValue(new Error('network'))

      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.logout()
      })

      expect(mockClearTokens).toHaveBeenCalled()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('completeOAuth', () => {
    it('用 refresh token 换取 session', async () => {
      mockApiPost.mockResolvedValue({
        accessToken: 'at-oauth',
        refreshToken: 'rt-oauth',
        user: makeUser({ username: 'gh-user' }),
      })

      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.completeOAuth('temp-refresh')
      })

      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'temp-refresh' },
        expect.objectContaining({ skipRefresh: true, auth: false }),
      )
      expect(mockSetTokens).toHaveBeenCalledWith('at-oauth', 'rt-oauth')
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('refresh', () => {
    it('重新调用 /auth/session', async () => {
      mockApiGet.mockResolvedValue({ user: null })
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(result.current.loading).toBe(false))
      mockApiGet.mockResolvedValue({ user: makeUser() })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockApiGet).toHaveBeenCalledWith('/auth/session')
      expect(result.current.isAuthenticated).toBe(true)
    })
  })
})
