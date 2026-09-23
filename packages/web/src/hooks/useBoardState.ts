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
} from '@/lib/storage'

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
}

export function useBoardState(boardId: string | null, isAuthenticated: boolean) {
  const [state, setState] = useState<TierState>(DEFAULT_STATE)
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
          state: mapCloudImagesToState(board.tiers, board.images, boardId),
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
      setState(result.state)
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
  }, [load])

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
  }
}

export async function migrateLocalToCloud(): Promise<{ imported: number; skipped: number }> {
  const localBoards = loadAllBoards()
  let imported = 0
  let skipped = 0

  for (const board of localBoards) {
    try {
      const created = await api.post<CloudBoardSummary>('/boards', {
        title: board.title,
        description: board.description,
      })
      await api.put(`/boards/${created.id}/content`, board.state)
      imported++
    } catch {
      skipped++
    }
  }

  return { imported, skipped }
}

export function generateLocalBoardId(): string {
  return generateId()
}

export function localStateFromTierState(tierState: TierState): Record<string, ImageItem> {
  return tierState.images
}
