import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  setTokens,
  clearTokens,
} from '@/lib/tokens'

describe('tokens', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('access token', () => {
    it('初始状态返回 null', () => {
      expect(getAccessToken()).toBeNull()
    })

    it('设置后能读取', () => {
      setAccessToken('my-access-token')
      expect(getAccessToken()).toBe('my-access-token')
    })

    it('localStorage 异常时返回 null 不抛错', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('private mode')
      })
      expect(getAccessToken()).toBeNull()
    })
  })

  describe('refresh token', () => {
    it('初始状态返回 null', () => {
      expect(getRefreshToken()).toBeNull()
    })

    it('设置后能读取', () => {
      setRefreshToken('my-refresh-token')
      expect(getRefreshToken()).toBe('my-refresh-token')
    })
  })

  describe('setTokens', () => {
    it('同时写入 access 和 refresh', () => {
      setTokens('access-1', 'refresh-1')
      expect(getAccessToken()).toBe('access-1')
      expect(getRefreshToken()).toBe('refresh-1')
    })
  })

  describe('clearTokens', () => {
    it('清除后两个 token 都为 null', () => {
      setTokens('a', 'r')
      clearTokens()
      expect(getAccessToken()).toBeNull()
      expect(getRefreshToken()).toBeNull()
    })

    it('localStorage 异常时不抛错', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('private mode')
      })
      expect(() => clearTokens()).not.toThrow()
    })
  })
})
