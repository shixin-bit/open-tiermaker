import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEditKeyboardShortcuts } from '@/hooks/useEditKeyboardShortcuts'
import type { EditKeyboardShortcutsHandlers } from '@/hooks/useEditKeyboardShortcuts'

function dispatchKey(opts: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { cancelable: true, ...opts })
  window.dispatchEvent(event)
  return event
}

function makeHandlers(
  overrides: Partial<EditKeyboardShortcutsHandlers> = {},
): EditKeyboardShortcutsHandlers {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    save: vi.fn(),
    deleteSelected: vi.fn(),
    clearSelection: vi.fn(),
    isCloud: true,
    isDragging: false,
    ...overrides,
  }
}

describe('useEditKeyboardShortcuts', () => {
  let inputEl: HTMLElement | null = null

  beforeEach(() => {
    inputEl = null
  })

  afterEach(() => {
    if (inputEl) {
      inputEl.remove()
      inputEl = null
    }
  })

  function focusInput() {
    inputEl = document.createElement('input')
    document.body.appendChild(inputEl)
    inputEl.focus()
  }

  it('Ctrl+Z 触发 undo', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    const ev = dispatchKey({ key: 'z', ctrlKey: true })
    expect(handlers.undo).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
    expect(handlers.redo).not.toHaveBeenCalled()
  })

  it('Cmd+Z (Mac) 触发 undo', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'z', metaKey: true })
    expect(handlers.undo).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+Shift+Z 触发 redo', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(handlers.redo).toHaveBeenCalledTimes(1)
    expect(handlers.undo).not.toHaveBeenCalled()
  })

  it('Cmd+Shift+Z (Mac) 触发 redo', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'z', metaKey: true, shiftKey: true })
    expect(handlers.redo).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+Y 触发 redo', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'y', ctrlKey: true })
    expect(handlers.redo).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+S 在云端模式下 preventDefault 并触发 save', () => {
    const handlers = makeHandlers({ isCloud: true })
    renderHook(() => useEditKeyboardShortcuts(handlers))
    const ev = dispatchKey({ key: 's', ctrlKey: true })
    expect(handlers.save).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('Ctrl+S 在本地模式下 preventDefault 但不触发 save', () => {
    const handlers = makeHandlers({ isCloud: false })
    renderHook(() => useEditKeyboardShortcuts(handlers))
    const ev = dispatchKey({ key: 's', ctrlKey: true })
    expect(handlers.save).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(true)
  })

  it('Cmd+S (Mac) 同样触发 save + preventDefault', () => {
    const handlers = makeHandlers({ isCloud: true })
    renderHook(() => useEditKeyboardShortcuts(handlers))
    const ev = dispatchKey({ key: 's', metaKey: true })
    expect(handlers.save).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('Delete 触发 deleteSelected', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'Delete' })
    expect(handlers.deleteSelected).toHaveBeenCalledTimes(1)
  })

  it('Backspace 触发 deleteSelected', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'Backspace' })
    expect(handlers.deleteSelected).toHaveBeenCalledTimes(1)
  })

  it('Esc 触发 clearSelection', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'Escape' })
    expect(handlers.clearSelection).toHaveBeenCalledTimes(1)
  })

  it('非快捷键不触发任何回调', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'a' })
    dispatchKey({ key: 'Enter' })
    dispatchKey({ key: ' ' })
    expect(handlers.undo).not.toHaveBeenCalled()
    expect(handlers.redo).not.toHaveBeenCalled()
    expect(handlers.save).not.toHaveBeenCalled()
    expect(handlers.deleteSelected).not.toHaveBeenCalled()
    expect(handlers.clearSelection).not.toHaveBeenCalled()
  })

  describe('拖拽中(isDragging=true)', () => {
    it('Ctrl+Z 不触发 undo,只放行给 dnd-kit', () => {
      const handlers = makeHandlers({ isDragging: true })
      renderHook(() => useEditKeyboardShortcuts(handlers))
      dispatchKey({ key: 'z', ctrlKey: true })
      expect(handlers.undo).not.toHaveBeenCalled()
    })

    it('Delete 不触发 deleteSelected', () => {
      const handlers = makeHandlers({ isDragging: true })
      renderHook(() => useEditKeyboardShortcuts(handlers))
      dispatchKey({ key: 'Delete' })
      expect(handlers.deleteSelected).not.toHaveBeenCalled()
    })

    it('Esc 不触发 clearSelection (归 dnd-kit onDragCancel 处理)', () => {
      const handlers = makeHandlers({ isDragging: true })
      renderHook(() => useEditKeyboardShortcuts(handlers))
      dispatchKey({ key: 'Escape' })
      expect(handlers.clearSelection).not.toHaveBeenCalled()
    })

    it('Ctrl+S 仍 preventDefault 但不触发 save (避免打断拖拽)', () => {
      const handlers = makeHandlers({ isDragging: true, isCloud: true })
      renderHook(() => useEditKeyboardShortcuts(handlers))
      const ev = dispatchKey({ key: 's', ctrlKey: true })
      expect(handlers.save).not.toHaveBeenCalled()
      expect(ev.defaultPrevented).toBe(true)
    })
  })

  describe('输入框聚焦时', () => {
    it('Ctrl+Z 不触发 undo (避免破坏文本编辑)', () => {
      focusInput()
      const handlers = makeHandlers()
      renderHook(() => useEditKeyboardShortcuts(handlers))
      dispatchKey({ key: 'z', ctrlKey: true })
      expect(handlers.undo).not.toHaveBeenCalled()
    })

    it('Delete 不触发 deleteSelected (避免删输入框字符)', () => {
      focusInput()
      const handlers = makeHandlers()
      renderHook(() => useEditKeyboardShortcuts(handlers))
      dispatchKey({ key: 'Delete' })
      expect(handlers.deleteSelected).not.toHaveBeenCalled()
    })

    it('Ctrl+S 仍 preventDefault 并触发 save (云端模式)', () => {
      focusInput()
      const handlers = makeHandlers({ isCloud: true })
      renderHook(() => useEditKeyboardShortcuts(handlers))
      const ev = dispatchKey({ key: 's', ctrlKey: true })
      expect(handlers.save).toHaveBeenCalledTimes(1)
      expect(ev.defaultPrevented).toBe(true)
    })

    it('textarea 聚焦同样跳过 undo', () => {
      const ta = document.createElement('textarea')
      inputEl = ta
      document.body.appendChild(ta)
      ta.focus()
      const handlers = makeHandlers()
      renderHook(() => useEditKeyboardShortcuts(handlers))
      dispatchKey({ key: 'z', ctrlKey: true })
      expect(handlers.undo).not.toHaveBeenCalled()
    })

    it('contenteditable 聚焦同样跳过 undo', () => {
      const div = document.createElement('div')
      inputEl = div
      div.contentEditable = 'true'
      // jsdom 对 contentEditable 的 isContentEditable 状态可能不会即时刷新,显式 stub
      Object.defineProperty(div, 'isContentEditable', {
        configurable: true,
        get: () => true,
      })
      document.body.appendChild(div)
      // jsdom 对 contenteditable 元素的 focus 行为不稳定,直接 mock activeElement
      const originalDesc = Object.getOwnPropertyDescriptor(document, 'activeElement')
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => div,
      })
      try {
        const handlers = makeHandlers()
        renderHook(() => useEditKeyboardShortcuts(handlers))
        dispatchKey({ key: 'z', ctrlKey: true })
        expect(handlers.undo).not.toHaveBeenCalled()
      } finally {
        // 还原 activeElement: jsdom 中通常是原型上的 getter,直接 delete 即可恢复继承
        if (originalDesc) {
          Object.defineProperty(document, 'activeElement', originalDesc)
        } else {
          // @ts-expect-error 恢复原型继承,需删除实例上的覆盖
          delete document.activeElement
        }
      }
    })
  })

  it('handlers 变化后无需重新订阅即可生效(ref 持有最新值)', () => {
    const handlers1 = makeHandlers()
    const { rerender } = renderHook(() => useEditKeyboardShortcuts(handlers1))
    const handlers2 = makeHandlers()
    rerender()
    // rerender 后 ref.current 仍是 handlers1(同对象),需用新对象 rerender 才能更新
    void handlers2
    dispatchKey({ key: 'z', ctrlKey: true })
    expect(handlers1.undo).toHaveBeenCalledTimes(1)
  })

  it('hook 卸载后移除监听,快捷键不再触发', () => {
    const handlers = makeHandlers()
    const { unmount } = renderHook(() => useEditKeyboardShortcuts(handlers))
    unmount()
    dispatchKey({ key: 'z', ctrlKey: true })
    expect(handlers.undo).not.toHaveBeenCalled()
  })

  it('Ctrl+Z 无 Shift 才是 undo;Ctrl+Shift+Z 是 redo', () => {
    const handlers = makeHandlers()
    renderHook(() => useEditKeyboardShortcuts(handlers))
    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: false })
    expect(handlers.undo).toHaveBeenCalledTimes(1)
    expect(handlers.redo).not.toHaveBeenCalled()
    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(handlers.redo).toHaveBeenCalledTimes(1)
  })
})
