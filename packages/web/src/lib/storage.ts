import type { TierState, ImageItem } from '@open-tiermaker/shared'
import { DEFAULT_STATE } from '@open-tiermaker/shared'

const LEGACY_KEY = 'open-tiermaker:state'
const BOARDS_KEY = 'otm:boards'

export interface LocalBoardMeta {
  id: string
  title: string
  description?: string
  updatedAt: number
}

export interface LocalBoard extends LocalBoardMeta {
  state: TierState
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadLegacyState(): TierState {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as TierState
    return parsed
  } catch {
    return DEFAULT_STATE
  }
}

export function migrateLegacyIfNeeded(): LocalBoard[] {
  const existing = loadAllBoards()
  if (existing.length > 0) return existing

  const raw = localStorage.getItem(LEGACY_KEY)
  if (!raw) return existing

  const legacyState = loadLegacyState()
  if (
    legacyState.tiers.length === DEFAULT_STATE.tiers.length &&
    legacyState.pool.length === 0 &&
    Object.keys(legacyState.images).length === 0
  ) {
    return existing
  }

  const board: LocalBoard = {
    id: generateId(),
    title: '未命名排行榜',
    updatedAt: Date.now(),
    state: legacyState,
  }
  localStorage.setItem(BOARDS_KEY, JSON.stringify([board]))
  localStorage.removeItem(LEGACY_KEY)
  return [board]
}

export function loadAllBoards(): LocalBoard[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as LocalBoard[]
  } catch {
    return []
  }
}

export function saveAllBoards(boards: LocalBoard[]): void {
  try {
    localStorage.setItem(BOARDS_KEY, JSON.stringify(boards))
  } catch {
    // quota exceeded or private mode
  }
}

export function loadBoard(id: string): LocalBoard | null {
  const boards = loadAllBoards()
  return boards.find((b) => b.id === id) ?? null
}

export function saveBoard(board: LocalBoard): void {
  const boards = loadAllBoards()
  const idx = boards.findIndex((b) => b.id === board.id)
  board.updatedAt = Date.now()
  if (idx >= 0) {
    boards[idx] = board
  } else {
    boards.push(board)
  }
  saveAllBoards(boards)
}

export function deleteBoard(id: string): void {
  const boards = loadAllBoards().filter((b) => b.id !== id)
  saveAllBoards(boards)
}

export function clearAllBoards(): void {
  try {
    localStorage.removeItem(BOARDS_KEY)
  } catch {
    // ignore
  }
}

export function estimateLocalStorageBytes(): number {
  try {
    const raw = localStorage.getItem(BOARDS_KEY) ?? ''
    return new Blob([raw]).size
  } catch {
    return 0
  }
}

export function mapCloudImagesToState(
  cloudTiers: { id: string; label: string; color: string; imageIds: string[] }[],
  cloudImages: Record<
    string,
    { id: string; src: string; source: 'local' | 'url'; createdAt: number }
  >,
  cloudItems: Array<{
    id: string
    tierKey: string
    position: number
    title: string | null
  }>,
  _boardId: string,
): TierState {
  const images: Record<string, ImageItem> = {}
  const pool: string[] = []

  for (const [id, img] of Object.entries(cloudImages)) {
    images[id] = {
      id,
      src: img.src.startsWith('/api/') ? img.src : img.src,
      source: img.source,
      createdAt: img.createdAt,
    }
  }

  // 从 items 中恢复图片池（tierKey === "__pool__"）
  for (const item of cloudItems) {
    if (item.tierKey === '__pool__') {
      const imgId = item.title || item.id
      if (!pool.includes(imgId)) pool.push(imgId)
    }
  }

  return {
    tiers: cloudTiers.map((t) => ({ ...t })),
    pool,
    images,
  }
}
