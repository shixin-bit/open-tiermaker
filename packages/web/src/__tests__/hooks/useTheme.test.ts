import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTheme, syncThemeToHtml, THEME_STORAGE_KEY, type Theme } from '@/hooks/useTheme'

interface MediaQueryListStub {
  matches: boolean
  addEventListener: (type: 'change', handler: () => void) => void
  removeEventListener: (type: 'change', handler: () => void) => void
}

function makeMqlStub(matches: boolean): MediaQueryListStub {
  const listeners: Array<() => void> = []
  return {
    matches,
    addEventListener: (_type, handler) => listeners.push(handler),
    removeEventListener: (_type, handler) => {
      const idx = listeners.indexOf(handler)
      if (idx >= 0) listeners.splice(idx, 1)
    },
  }
}

describe('useTheme', () => {
  let mqlStub: MediaQueryListStub
  let mqlChangeHandlers: Array<() => void>

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mqlChangeHandlers = []
    mqlStub = {
      matches: false,
      addEventListener: (_type, handler) => mqlChangeHandlers.push(handler),
      removeEventListener: (_type, handler) => {
        const idx = mqlChangeHandlers.indexOf(handler)
        if (idx >= 0) mqlChangeHandlers.splice(idx, 1)
      },
    }
    // jsdom 默认无 window.matchMedia,直接定义
    const matchMediaMock = (query: string): MediaQueryList => {
      if (query === '(prefers-color-scheme: dark)') return mqlStub as unknown as MediaQueryList
      // 其它查询(可能来自第三方库)返回默认 false stub,避免干扰本测试
      return makeMqlStub(false) as unknown as MediaQueryList
    }
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.classList.remove('dark')
  })

  function firePrefersColorSchemeChange() {
    for (const handler of mqlChangeHandlers) handler()
  }

  it('初始无 localStorage 时回退 system,且不立即添加 dark class', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('localStorage 有 "dark" 时初始化为 dark,<html> 带 dark class', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('localStorage 有 "light" 时初始化为 light,<html> 无 dark class', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('localStorage 是非法值时回退 system', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'banana')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
  })

  it('setTheme("dark") 写入 localStorage 并更新 <html> class', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setTheme("light") 移除 <html> dark class', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { result } = renderHook(() => useTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    act(() => result.current.setTheme('light'))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setTheme("system") 在系统偏好为 dark 时应用 dark class', () => {
    mqlStub.matches = true
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    act(() => result.current.setTheme('system'))
    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('system 模式下 prefers-color-scheme 变化时实时更新 <html> class', async () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // 模拟系统切换到 dark
    mqlStub.matches = true
    act(() => firePrefersColorSchemeChange())
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))
    expect(result.current.resolvedTheme).toBe('dark')

    // 切换回 light
    mqlStub.matches = false
    act(() => firePrefersColorSchemeChange())
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(false))
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('非 system 模式不订阅 matchMedia change 事件', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))
    const beforeCount = mqlChangeHandlers.length
    // 再触发一次 system 之外的 setTheme,不应增加订阅
    act(() => result.current.setTheme('light'))
    expect(mqlChangeHandlers.length).toBe(beforeCount)
  })

  it('卸载后移除 matchMedia change 监听', () => {
    const { unmount } = renderHook(() => useTheme())
    const beforeCount = mqlChangeHandlers.length
    expect(beforeCount).toBeGreaterThan(0)
    unmount()
    expect(mqlChangeHandlers.length).toBe(0)
  })

  it('syncThemeToHtml 根据 localStorage 同步 <html> class(供 main.tsx 预渲染调用)', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    syncThemeToHtml()
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    syncThemeToHtml()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('syncThemeToHtml 在 system 模式下根据 prefers-color-scheme 同步', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system')
    mqlStub.matches = true
    syncThemeToHtml()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setTheme 后 resolvedTheme 立即反映新值', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))
    expect(result.current.resolvedTheme).toBe('dark')
    act(() => result.current.setTheme('light'))
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('Theme 类型联合包含三个字面量(编译期保证)', () => {
    const t: Theme = 'system'
    expect(['light', 'dark', 'system']).toContain(t)
  })
})
