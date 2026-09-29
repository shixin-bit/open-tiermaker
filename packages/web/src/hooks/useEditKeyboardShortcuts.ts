import { useEffect, useRef } from 'react'

export interface EditKeyboardShortcutsHandlers {
  /** 撤销 */
  undo: () => void
  /** 重做 */
  redo: () => void
  /** 保存(仅在 isCloud 为 true 时触发) */
  save: () => void
  /** 删除当前选中的图片集合 */
  deleteSelected: () => void
  /** 清空选中集合 */
  clearSelection: () => void
  /** 是否云端模式(决定 Ctrl+S 是否实际触发 save) */
  isCloud: boolean
  /** 是否正在拖拽(为 true 时除 Ctrl+S preventDefault 外,其余快捷键全部 no-op) */
  isDragging: boolean
}

/**
 * 判断当前 active 元素是否为可输入元素(input / textarea / contenteditable)。
 */
function isEditableFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return false
}

function isUndoKey(e: KeyboardEvent): boolean {
  // Ctrl+Z (无 Shift) 或 Cmd+Z (无 Shift)
  if (e.key.toLowerCase() !== 'z') return false
  if (e.shiftKey) return false
  return e.ctrlKey || e.metaKey
}

function isRedoKey(e: KeyboardEvent): boolean {
  // Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') return true
  if (e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'y') return true
  return false
}

function isSaveKey(e: KeyboardEvent): boolean {
  if (e.key.toLowerCase() !== 's') return false
  return e.ctrlKey || e.metaKey
}

function isDeleteKey(e: KeyboardEvent): boolean {
  return e.key === 'Delete' || e.key === 'Backspace'
}

/**
 * 编辑页全局键盘快捷键 hook。
 *
 * 判断顺序(详见 design.md D3):
 * 1. isDragging 为 true → 仅 Ctrl+S/Cmd+S 调 preventDefault(阻止浏览器保存网页,
 *    但不触发 save),其余快捷键直接 return
 * 2. 输入框聚焦(input/textarea/contenteditable) → 仅 Ctrl+S/Cmd+S preventDefault + save
 *    (若 isCloud),其余快捷键 return
 * 3. 否则按规则触发:
 *    - Ctrl+Z / Cmd+Z → undo
 *    - Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y → redo
 *    - Ctrl+S / Cmd+S → preventDefault + save(if isCloud)
 *    - Delete / Backspace → deleteSelected
 *    - Esc → clearSelection
 *
 * 通过 ref 持有最新的 handlers,避免每次 render 重新订阅 window 监听器。
 */
export function useEditKeyboardShortcuts(handlers: EditKeyboardShortcutsHandlers): void {
  const ref = useRef(handlers)
  // 在 effect 中更新 ref,避免在 render 期间写入(lint react-hooks/refs)
  useEffect(() => {
    ref.current = handlers
  }, [handlers])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { isDragging, isCloud, undo, redo, save, deleteSelected, clearSelection } = ref.current

      // 优先级 1:拖拽中只拦 Ctrl+S,其余全部放行给 dnd-kit 处理
      if (isDragging) {
        if (isSaveKey(e)) {
          e.preventDefault()
        }
        return
      }

      // Ctrl+S 在任何状态(包括输入框聚焦)都要 preventDefault + save(if isCloud)
      if (isSaveKey(e)) {
        e.preventDefault()
        if (isCloud) save()
        return
      }

      // 优先级 2:输入框聚焦时其余快捷键全部 return
      if (isEditableFocused()) return

      // 优先级 3:正常响应
      if (isUndoKey(e)) {
        e.preventDefault()
        undo()
        return
      }
      if (isRedoKey(e)) {
        e.preventDefault()
        redo()
        return
      }
      if (isDeleteKey(e)) {
        e.preventDefault()
        deleteSelected()
        return
      }
      if (e.key === 'Escape') {
        clearSelection()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
