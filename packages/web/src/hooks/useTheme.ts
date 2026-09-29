import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'open-tiermaker-theme'

/**
 * 读取系统配色偏好(通过 prefers-color-scheme: dark 媒体查询)。
 * SSR 或不支持 matchMedia 的环境回退到 'light'。
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * 根据 theme 与系统偏好计算实际生效的主题。
 */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme
}

/**
 * 将 resolved theme 应用到 <html> 元素的 class 列表。
 * dark → 添加 'dark' class;light → 移除 'dark' class。
 */
function applyThemeToHtml(theme: Theme): void {
  if (typeof document === 'undefined') return
  const effective = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', effective === 'dark')
}

/**
 * 从 localStorage 读取并校验 theme 值,非法值或缺失时回退 'system'。
 */
function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

/**
 * 同步主题到 <html>。供 main.tsx 在 ReactDOM render 之前调用,避免主题闪烁。
 * 不订阅任何后续变化(由 useTheme 内部 effect 负责)。
 */
export function syncThemeToHtml(): void {
  applyThemeToHtml(readStoredTheme())
}

export interface UseTheme {
  /** 用户的主题偏好(可能是 'system',并非实际生效值) */
  theme: Theme
  /** 设置新主题:写入 localStorage + 更新 React state + 同步 <html> class */
  setTheme: (t: Theme) => void
  /** 实际生效的主题(system 模式下根据 prefers-color-scheme 解析) */
  resolvedTheme: 'light' | 'dark'
}

/**
 * 暗色主题 hook。
 *
 * - 初始值从 localStorage(`open-tiermaker-theme`)读取,非法/缺失时回退 'system'
 * - 'system' 模式下监听 `prefers-color-scheme: dark` 变化实时更新 <html> class
 * - setTheme(t) 持久化到 localStorage 并同步 <html> class
 *
 * 与 `syncThemeToHtml` 配合:在 main.tsx 渲染前调用一次避免首屏闪烁。
 */
export function useTheme(): UseTheme {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())
  // systemDark 是外部状态(matchMedia 的查询结果),只在监听器中更新;
  // resolvedTheme 派生自 theme + systemDark,无需独立 state 避免 effect 内 setState
  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemTheme() === 'dark')

  // 副作用:theme 或系统配色变化时,同步 <html> class
  useEffect(() => {
    applyThemeToHtml(theme)
    if (theme !== 'system') return

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      setSystemDark(mql.matches)
      applyThemeToHtml('system')
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme])

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, t)
    setThemeState(t)
  }, [])

  return { theme, setTheme, resolvedTheme }
}
