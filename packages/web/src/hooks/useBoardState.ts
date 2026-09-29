import { useCallback, useEffect, useState } from 'react'
import type { TierState, ImageItem } from '@open-tiermaker/shared'
import { DEFAULT_STATE } from '@open-tiermaker/shared'
import { api } from '@/lib/api/client'
import type { LocalBoard } from '@/lib/storage'
import {
  loadBoard,
  saveBoard,
  generateId,
  mapCloudImagesToState,
  loadAllBoards,
  clearAllBoards,
} from '@/lib/storage'
import { useUndoRedo } from '@/hooks/useUndoRedo'

export interface CloudBoardSummary {
  id: string
  title: string
  description: string | null
  visibility: 'private' | 'public' | 'unlisted'
  shareId: string | null
  hasSharePassword: boolean
  _count?: { items: number }
  createdAt: string
  updatedAt: string
}

export interface CloudBoardDetail {
  id: string
  title: string
  description: string | null
  visibility: 'private' | 'public' | 'unlisted'
  shareId: string | null
  hasSharePassword: boolean
  tiers: { id: string; label: string; color: string; imageIds: string[] }[]
  items: Array<{
    id: string
    tierKey: string
    position: number
    title: string | null
    hasImage: boolean
  }>
  images: Record<string, { id: string; src: string; source: 'local' | 'url'; createdAt: number }>
  createdAt: string
  updatedAt: string
}

export interface BoardState extends LocalBoard {
  boardId: string | null
  isCloud: boolean
  loading: boolean
  loaded: boolean
  save: () => Promise<void>
  isSaving: boolean
  visibility?: 'private' | 'public' | 'unlisted'
  shareId?: string | null
  sharePasswordSet?: boolean
  updateVisibility: (v: 'private' | 'public' | 'unlisted') => Promise<void>
  regenerateShareId: () => Promise<void>
  updateSharePassword: (password: string | null) => Promise<void>
  // Undo/Redo 历史栈(本期新增)
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export function useBoardState(boardId: string | null, isAuthenticated: boolean) {
  // TierState 走 Undo/Redo 历史栈;title/description 等元数据保持独立 useState 不入历史栈
  const {
    state,
    set: setState,
    reset,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useUndoRedo<TierState>(DEFAULT_STATE)
  const [title, setTitle] = useState('未命名排行榜')
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [visibility, setVisibility] = useState<'private' | 'public' | 'unlisted'>('private')
  const [shareId, setShareId] = useState<string | null>(null)
  const [sharePasswordSet, setSharePasswordSet] = useState(false)

  type LoadResult = {
    state: TierState
    title: string
    description?: string
    visibility: 'private' | 'public' | 'unlisted'
    shareId: string | null
    sharePasswordSet: boolean
    loaded: boolean
  }

  const load = useCallback(async (): Promise<LoadResult> => {
    if (!boardId) {
      return {
        state: DEFAULT_STATE,
        title: '未命名排行榜',
        description: undefined,
        visibility: 'private',
        shareId: null,
        sharePasswordSet: false,
        loaded: true,
      }
    }

    try {
      if (isAuthenticated) {
        const board = await api.get<CloudBoardDetail>(`/boards/${boardId}`)
        return {
          state: mapCloudImagesToState(board.tiers, board.images, board.items, boardId),
          title: board.title,
          description: board.description ?? undefined,
          visibility: board.visibility,
          shareId: board.shareId,
          sharePasswordSet: board.hasSharePassword,
          loaded: true,
        }
      } else {
        const local = loadBoard(boardId)
        return {
          state: local ? local.state : DEFAULT_STATE,
          title: local ? local.title : '未命名排行榜',
          description: local?.description,
          visibility: 'private',
          shareId: null,
          sharePasswordSet: false,
          loaded: true,
        }
      }
    } catch {
      return {
        state: DEFAULT_STATE,
        title: '未命名排行榜',
        description: undefined,
        visibility: 'private',
        shareId: null,
        sharePasswordSet: false,
        loaded: true,
      }
    }
  }, [boardId, isAuthenticated])

  useEffect(() => {
    let cancelled = false
    load().then((result) => {
      if (cancelled) return
      // 加载新榜单时用 reset 清空历史栈,避免 undo 跨榜单回退到旧数据
      reset(result.state)
      setTitle(result.title)
      setDescription(result.description)
      setVisibility(result.visibility)
      setShareId(result.shareId)
      setSharePasswordSet(result.sharePasswordSet)
      setLoaded(result.loaded)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [load, reset])

  // 游客模式下自动保存到 localStorage（防抖 1 秒），避免用户忘记点保存按钮导致数据丢失
  useEffect(() => {
    if (!boardId || isAuthenticated || !loaded) return
    const timer = setTimeout(() => {
      saveBoard({
        id: boardId,
        title,
        description,
        state,
        updatedAt: Date.now(),
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [boardId, isAuthenticated, loaded, state, title, description])

  const save = useCallback(
    async (newState?: TierState, newTitle?: string, newDescription?: string) => {
      setIsSaving(true)
      try {
        const stateToSave = newState ?? state
        const titleToSave = newTitle ?? title
        const descToSave = newDescription ?? description

        if (isAuthenticated && boardId) {
          await api.put(`/boards/${boardId}/content`, stateToSave)
          if (titleToSave !== title || descToSave !== description) {
            await api.put(`/boards/${boardId}`, {
              title: titleToSave,
              description: descToSave ?? null,
            })
          }
        } else if (boardId) {
          const existing = loadBoard(boardId)
          saveBoard({
            id: boardId,
            title: titleToSave,
            description: descToSave,
            state: stateToSave,
            updatedAt: existing?.updatedAt ?? Date.now(),
          })
        }
      } finally {
        setIsSaving(false)
      }
    },
    [boardId, isAuthenticated, state, title, description],
  )

  const updateVisibility = useCallback(
    async (v: 'private' | 'public' | 'unlisted') => {
      if (!isAuthenticated || !boardId) return
      await api.put(`/boards/${boardId}`, { visibility: v })
      setVisibility(v)
      if (v !== 'private' && !shareId) {
        const res = await api.post<{ id: string; shareId: string | null }>(
          `/boards/${boardId}/share`,
        )
        setShareId(res.shareId)
      }
    },
    [isAuthenticated, boardId, shareId],
  )

  const regenerateShareId = useCallback(async () => {
    if (!isAuthenticated || !boardId) return
    const res = await api.post<{ id: string; shareId: string | null }>(`/boards/${boardId}/share`)
    setShareId(res.shareId)
  }, [isAuthenticated, boardId])

  const updateSharePassword = useCallback(
    async (password: string | null) => {
      if (!isAuthenticated || !boardId) return
      await api.put(`/boards/${boardId}`, { sharePassword: password })
      setSharePasswordSet(password !== null && password !== '')
    },
    [isAuthenticated, boardId],
  )

  return {
    state,
    setState,
    title,
    setTitle,
    description,
    setDescription,
    loading,
    loaded,
    save,
    isSaving,
    isCloud: isAuthenticated && !!boardId,
    visibility,
    shareId,
    sharePasswordSet,
    updateVisibility,
    regenerateShareId,
    updateSharePassword,
    // Undo/Redo 历史(本期新增)
    canUndo,
    canRedo,
    undo,
    redo,
  }
}

let lastMigrationMapping: Record<string, string> = {}

export async function migrateLocalToCloud(): Promise<{
  imported: number
  skipped: number
  mapping: Record<string, string>
}> {
  const localBoards = loadAllBoards()
  let imported = 0
  let skipped = 0
  const mapping: Record<string, string> = {}

  for (const board of localBoards) {
    try {
      const created = await api.post<CloudBoardSummary>('/boards', {
        title: board.title,
        description: board.description,
      })
      await api.put(`/boards/${created.id}/content`, board.state)
      mapping[board.id] = created.id
      imported++
    } catch {
      skipped++
    }
  }

  // 迁移成功后清理本地数据，避免重复迁移
  if (imported > 0) {
    clearAllBoards()
  }

  lastMigrationMapping = mapping
  return { imported, skipped, mapping }
}

export function getLastMigrationMapping(): Record<string, string> {
  return lastMigrationMapping
}

export function generateLocalBoardId(): string {
  return generateId()
}

export function localStateFromTierState(tierState: TierState): Record<string, ImageItem> {
  return tierState.images
}
