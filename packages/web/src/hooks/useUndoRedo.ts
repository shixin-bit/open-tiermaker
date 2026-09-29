import { useCallback, useReducer } from 'react'
import type { ActionType } from '@open-tiermaker/shared'

/**
 * 历史栈上限,past 数组超过此长度时丢弃最旧条目。
 */
const MAX_PAST = 100

/**
 * 同 actionType 连续合并时间窗口(毫秒)。
 * 在此窗口内的连续 set 只会替换 present,不会推入新的历史条目。
 */
const MERGE_WINDOW_MS = 300

/**
 * 三段式历史栈状态。
 * - past: 历史栈,末尾为最近一次的旧状态
 * - present: 当前状态
 * - future: 重做栈,末尾为最近一次被 undo 的状态
 * - lastAction: 上一次 set 的动作类型与时间戳,用于合并判定
 */
interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
  lastAction: { type: ActionType; timestamp: number } | null
}

function init<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [], lastAction: null }
}

type SetUpdate<T> = T | ((prev: T) => T)

interface SetAction<T> {
  type: 'SET'
  payload: { update: SetUpdate<T>; actionType: ActionType; timestamp: number }
}
interface UndoAction {
  type: 'UNDO'
}
interface RedoAction {
  type: 'REDO'
}
interface ResetAction<T> {
  type: 'RESET'
  payload: T
}

type Action<T> = SetAction<T> | UndoAction | RedoAction | ResetAction<T>

function applyUpdate<T>(present: T, update: SetUpdate<T>): T {
  return typeof update === 'function' ? (update as (prev: T) => T)(present) : update
}

function reducer<T>(state: HistoryState<T>, action: Action<T>): HistoryState<T> {
  switch (action.type) {
    case 'SET': {
      const { update, actionType, timestamp } = action.payload
      const newPresent = applyUpdate(state.present, update)
      if (newPresent === state.present) {
        // 无变化不入历史栈
        return state
      }
      const isMerge =
        state.lastAction !== null &&
        state.lastAction.type === actionType &&
        timestamp - state.lastAction.timestamp < MERGE_WINDOW_MS

      if (isMerge) {
        // 合并:只替换 present,不推 past,清空 future
        return {
          past: state.past,
          present: newPresent,
          future: [],
          lastAction: { type: actionType, timestamp },
        }
      }

      // 新历史条目
      const newPast = [...state.past, state.present]
      if (newPast.length > MAX_PAST) {
        newPast.splice(0, newPast.length - MAX_PAST)
      }
      return {
        past: newPast,
        present: newPresent,
        future: [],
        lastAction: { type: actionType, timestamp },
      }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const newPast = state.past.slice(0, -1)
      const newFuture = [...state.future, state.present]
      return {
        past: newPast,
        present: previous,
        future: newFuture,
        // 撤销后下次 set 视为新的编辑路径,不与撤销前的同类型操作合并
        lastAction: null,
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[state.future.length - 1]
      const newFuture = state.future.slice(0, -1)
      const newPast = [...state.past, state.present]
      if (newPast.length > MAX_PAST) {
        newPast.splice(0, newPast.length - MAX_PAST)
      }
      return {
        past: newPast,
        present: next,
        future: newFuture,
        lastAction: null,
      }
    }
    case 'RESET': {
      return init(action.payload)
    }
    default:
      return state
  }
}

export interface UseUndoRedo<T> {
  state: T
  set: (update: SetUpdate<T>, actionType?: ActionType) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  reset: (newInitial: T) => void
}

/**
 * 泛型 Undo/Redo 历史栈 hook。
 *
 * 使用三段式 past/present/future 结构,支持:
 * - 同 actionType 在 300ms 内连续 set 合并(仅替换 present)
 * - 不同 actionType 或超出窗口则推入新历史条目
 * - past 数组上限 100,超出丢弃最旧
 * - undo/redo 后下次 set 视为新编辑路径,不再与之前合并
 *
 * @param initial 初始 present 状态
 */
export function useUndoRedo<T>(initial: T): UseUndoRedo<T> {
  const [history, dispatch] = useReducer(reducer<T>, initial, init)

  const set = useCallback((update: SetUpdate<T>, actionType: ActionType = 'drag') => {
    dispatch({
      type: 'SET',
      payload: { update, actionType, timestamp: Date.now() },
    })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [])

  const reset = useCallback((newInitial: T) => {
    dispatch({ type: 'RESET', payload: newInitial })
  }, [])

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    reset,
  }
}
