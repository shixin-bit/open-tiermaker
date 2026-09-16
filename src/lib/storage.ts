import type { TierState } from './types'
import { DEFAULT_STATE } from './types'

const STORAGE_KEY = 'open-tiermaker:state'

export function loadState(): TierState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as TierState
    return parsed
  } catch {
    return DEFAULT_STATE
  }
}

export function saveState(state: TierState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    console.warn('Failed to save state to localStorage')
  }
}
