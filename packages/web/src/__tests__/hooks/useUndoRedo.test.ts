import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoRedo } from '@/hooks/useUndoRedo'

interface Count {
  count: number
}

const BASE_TIME = new Date('2026-01-01T00:00:00.000Z').getTime()

describe('useUndoRedo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初始状态等于传入的 initial,空栈不可 undo/redo', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    expect(result.current.state).toEqual({ count: 0 })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('set 传入新对象值会推入新历史条目', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }))
    expect(result.current.state).toEqual({ count: 1 })
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('set 传入 updater 函数会推入新历史条目', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set((prev) => ({ count: prev.count + 5 })))
    expect(result.current.state).toEqual({ count: 5 })
    expect(result.current.canUndo).toBe(true)
  })

  it('undo 能依次回退到历史中的前一个状态', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }, 'drag'))
    vi.setSystemTime(BASE_TIME + 500) // 推进时间,避免与上次合并
    act(() => result.current.set({ count: 2 }, 'drag'))
    expect(result.current.state).toEqual({ count: 2 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 1 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
    expect(result.current.canUndo).toBe(false)
  })

  it('空栈 undo 不报错也不改变状态', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('redo 能恢复刚被 undo 的状态', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }))
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.redo())
    expect(result.current.state).toEqual({ count: 1 })
    expect(result.current.canRedo).toBe(false)
  })

  it('空 future 栈 redo 不报错也不改变状态', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.redo())
    expect(result.current.state).toEqual({ count: 0 })
    expect(result.current.canRedo).toBe(false)
  })

  it('undo 后新 set 会清空 future 栈', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }, 'drag'))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.set({ count: 5 }, 'drag'))
    expect(result.current.state).toEqual({ count: 5 })
    expect(result.current.canRedo).toBe(false)
  })

  it('同 actionType 在 300ms 内连续 set 合并为单条历史', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }, 'drag'))
    vi.setSystemTime(BASE_TIME + 100)
    act(() => result.current.set({ count: 2 }, 'drag'))
    vi.setSystemTime(BASE_TIME + 200)
    act(() => result.current.set({ count: 3 }, 'drag'))
    expect(result.current.state).toEqual({ count: 3 })
    // 合并后只有一条历史,一次 undo 回到最初
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('同 actionType 超过 300ms 不合并,各成独立历史条目', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }, 'drag'))
    vi.setSystemTime(BASE_TIME + 400) // 距上次 400ms,超出窗口
    act(() => result.current.set({ count: 2 }, 'drag'))
    expect(result.current.state).toEqual({ count: 2 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 1 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
  })

  it('不同 actionType 即使在 300ms 内也不合并', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }, 'drag'))
    // 紧接着不同 actionType,不应合并
    act(() => result.current.set({ count: 2 }, 'tier-label'))
    expect(result.current.state).toEqual({ count: 2 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 1 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
  })

  it('past 栈超过 100 截断最旧条目', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    // 推入 105 条历史,每次间隔 500ms 确保不合并
    for (let i = 1; i <= 105; i++) {
      vi.setSystemTime(BASE_TIME + i * 500)
      act(() => result.current.set({ count: i }, 'drag'))
    }
    expect(result.current.state).toEqual({ count: 105 })
    // 100 次 undo 回到 count=5(最早的 5 条被丢弃)
    for (let i = 0; i < 100; i++) {
      act(() => result.current.undo())
    }
    expect(result.current.state).toEqual({ count: 5 })
    expect(result.current.canUndo).toBe(false)
  })

  it('reset 清空历史栈并设置新的 present', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 5 }, 'drag'))
    act(() => result.current.set({ count: 10 }, 'drag'))
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.reset({ count: -1 }))
    expect(result.current.state).toEqual({ count: -1 })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('set 传入与 present 同一引用时为 no-op,不入历史栈', () => {
    const initial = { count: 0 }
    const { result } = renderHook(() => useUndoRedo(initial))
    act(() => result.current.set(initial))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.state).toBe(initial)
  })

  it('undo→redo 链路:连续 undo 多次后可再 redo 回最新状态', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }, 'drag'))
    vi.setSystemTime(BASE_TIME + 500)
    act(() => result.current.set({ count: 2 }, 'drag'))
    vi.setSystemTime(BASE_TIME + 1000)
    act(() => result.current.set({ count: 3 }, 'drag'))
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 2 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 1 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
    act(() => result.current.redo())
    expect(result.current.state).toEqual({ count: 1 })
    act(() => result.current.redo())
    expect(result.current.state).toEqual({ count: 2 })
    act(() => result.current.redo())
    expect(result.current.state).toEqual({ count: 3 })
    expect(result.current.canRedo).toBe(false)
  })

  it('undo 后再 set 同 actionType 不与已撤销的历史合并', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 }, 'drag'))
    act(() => result.current.undo())
    // 虽然与之前同 actionType,但 undo 把 lastAction 置 null,不应合并到已被撤销的历史
    vi.setSystemTime(BASE_TIME + 100)
    act(() => result.current.set({ count: 10 }, 'drag'))
    expect(result.current.state).toEqual({ count: 10 })
    act(() => result.current.undo())
    // 回到 count=0(原 1 已被 undo 并被新 set 替换)
    expect(result.current.state).toEqual({ count: 0 })
  })

  it('set 不传 actionType 时默认为 drag 并参与合并判定', () => {
    const { result } = renderHook(() => useUndoRedo<Count>({ count: 0 }))
    act(() => result.current.set({ count: 1 })) // 默认 'drag'
    vi.setSystemTime(BASE_TIME + 100)
    act(() => result.current.set({ count: 2 }, 'drag')) // 显式 drag,应与默认合并
    expect(result.current.state).toEqual({ count: 2 })
    act(() => result.current.undo())
    expect(result.current.state).toEqual({ count: 0 })
    expect(result.current.canUndo).toBe(false)
  })
})
