import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { THEME_STORAGE_KEY } from '@/hooks/useTheme'

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

describe('ThemeToggle', () => {
  let mqlStub: MediaQueryListStub

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mqlStub = makeMqlStub(false)
    const matchMediaMock = (query: string): MediaQueryList => {
      if (query === '(prefers-color-scheme: dark)') return mqlStub as unknown as MediaQueryList
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

  function getButtons() {
    return {
      light: screen.getByRole('button', { name: '切换到浅色主题' }),
      dark: screen.getByRole('button', { name: '切换到深色主题' }),
      system: screen.getByRole('button', { name: '切换到跟随系统主题' }),
    }
  }

  it('渲染三个主题按钮(浅色/深色/跟随系统)', () => {
    render(<ThemeToggle />)
    const { light, dark, system } = getButtons()
    expect(light).toBeInTheDocument()
    expect(dark).toBeInTheDocument()
    expect(system).toBeInTheDocument()
    expect(light).toHaveTextContent('浅色')
    expect(dark).toHaveTextContent('深色')
    expect(system).toHaveTextContent('跟随系统')
  })

  it('外层容器是 group 角色,带 aria-label', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('group', { name: '主题切换' })).toBeInTheDocument()
  })

  it('初始无 localStorage 时,system 按钮被高亮(aria-pressed=true)', () => {
    render(<ThemeToggle />)
    const { light, dark, system } = getButtons()
    expect(system).toHaveAttribute('aria-pressed', 'true')
    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(dark).toHaveAttribute('aria-pressed', 'false')
  })

  it('localStorage 有 "dark" 时 dark 按钮高亮', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    render(<ThemeToggle />)
    const { light, dark, system } = getButtons()
    expect(dark).toHaveAttribute('aria-pressed', 'true')
    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(system).toHaveAttribute('aria-pressed', 'false')
  })

  it('localStorage 有 "light" 时 light 按钮高亮', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    render(<ThemeToggle />)
    const { light } = getButtons()
    expect(light).toHaveAttribute('aria-pressed', 'true')
  })

  it('点击 dark 按钮切换主题并写入 localStorage', () => {
    render(<ThemeToggle />)
    const { dark } = getButtons()
    fireEvent.click(dark)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('点击 light 按钮移除 dark class', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    render(<ThemeToggle />)
    const { light } = getButtons()
    fireEvent.click(light)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('点击 system 按钮在系统偏好为 dark 时应用 dark class', () => {
    mqlStub.matches = true
    render(<ThemeToggle />)
    const { system } = getButtons()
    const { light } = getButtons()
    // 先切到 light,再切回 system,验证系统偏好生效
    fireEvent.click(light)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    fireEvent.click(system)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('切换后高亮态随之切换', () => {
    render(<ThemeToggle />)
    const { light, system } = getButtons()
    expect(system).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(light)
    expect(light).toHaveAttribute('aria-pressed', 'true')
    expect(system).toHaveAttribute('aria-pressed', 'false')
  })
})
