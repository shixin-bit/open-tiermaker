import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLocalStorageSize } from '@/hooks/useLocalStorageSize'

describe('useLocalStorageSize', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初始状态 size 为 0', () => {
    const { result } = renderHook(() => useLocalStorageSize())
    expect(result.current.size).toBe(0)
    expect(result.current.mb).toBe(0)
    expect(result.current.warning).toBe(false)
  })

  it('有 localStorage 数据时 size > 0', async () => {
    localStorage.setItem('some-key', 'x'.repeat(1000))
    const { result } = renderHook(() => useLocalStorageSize())
    await waitFor(() => expect(result.current.size).toBeGreaterThan(0))
  })

  it('超过 4MB 时 warning 为 true', async () => {
    // 用一个大的 value 估算接近 4MB（UTF-16 所以每个字符 2 字节）
    const big = 'x'.repeat(3 * 1024 * 1024) // 约 6MB
    localStorage.setItem('otm:boards', big)
    const { result } = renderHook(() => useLocalStorageSize())
    await waitFor(() => expect(result.current.warning).toBe(true))
  })

  it('监听 storage 事件并更新 size', async () => {
    const { result } = renderHook(() => useLocalStorageSize())
    const before = result.current.size

    act(() => {
      localStorage.setItem('new-key', 'y'.repeat(2000))
      window.dispatchEvent(new StorageEvent('storage', { key: 'new-key' }))
    })

    await waitFor(() => expect(result.current.size).toBeGreaterThan(before))
  })

  it('cleanup 清除 interval 和事件监听', () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderHook(() => useLocalStorageSize())
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})
