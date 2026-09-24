import { describe, it, expect, beforeEach } from 'vitest'
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
    clearTokens()
  })

  describe('access token（内存存储）', () => {
    it('初始状态返回 null', () => {
      expect(getAccessToken()).toBeNull()
    })

    it('设置后能读取', () => {
      setAccessToken('my-access-token')
      expect(getAccessToken()).toBe('my-access-token')
    })
  })

  describe('refresh token（HttpOnly Cookie，前端不存储）', () => {
    it('getRefreshToken 永远返回 null', () => {
      expect(getRefreshToken()).toBeNull()
    })

    it('setRefreshToken 是 no-op，getRefreshToken 仍返回 null', () => {
      setRefreshToken('my-refresh-token')
      expect(getRefreshToken()).toBeNull()
    })
  })

  describe('setTokens', () => {
    it('只写入 access token，refresh token 忽略', () => {
      setTokens('access-1', 'refresh-1')
      expect(getAccessToken()).toBe('access-1')
      expect(getRefreshToken()).toBeNull()
    })
  })

  describe('clearTokens', () => {
    it('清除后 access token 为 null', () => {
      setTokens('a', 'r')
      clearTokens()
      expect(getAccessToken()).toBeNull()
    })
  })
})
