import { useCallback, useEffect, useState } from 'react'
import type { ImageItem, TierState } from '@/lib/types'
import { DEFAULT_STATE } from '@/lib/types'
import { loadState, saveState } from '@/lib/storage'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useTierState() {
  const [state, setState] = useState<TierState>(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  const addImage = useCallback((src: string, source: 'local' | 'url') => {
    const id = generateId()
    const image: ImageItem = { id, src, source, createdAt: Date.now() }
    setState((prev) => ({
      ...prev,
      images: { ...prev.images, [id]: image },
      pool: [...prev.pool, id],
    }))
    return id
  }, [])

  const removeImage = useCallback((imageId: string) => {
    setState((prev) => {
      const { [imageId]: _, ...restImages } = prev.images
      return {
        ...prev,
        images: restImages,
        pool: prev.pool.filter((id) => id !== imageId),
        tiers: prev.tiers.map((t) => ({
          ...t,
          imageIds: t.imageIds.filter((id) => id !== imageId),
        })),
      }
    })
  }, [])

  const moveImage = useCallback(
    (
      imageId: string,
      from: { type: 'pool' } | { type: 'tier'; tierId: string },
      to: { type: 'pool' } | { type: 'tier'; tierId: string },
      newIndex?: number,
    ) => {
      setState((prev) => {
        let pool = [...prev.pool]
        const tiers = prev.tiers.map((t) => ({ ...t, imageIds: [...t.imageIds] }))

        if (from.type === 'pool') {
          pool = pool.filter((id) => id !== imageId)
        } else {
          const tier = tiers.find((t) => t.id === from.tierId)
          if (tier) {
            tier.imageIds = tier.imageIds.filter((id) => id !== imageId)
          }
        }

        const insertInto = (ids: string[]): string[] => {
          const arr = ids.filter((id) => id !== imageId)
          if (newIndex !== undefined && newIndex >= 0 && newIndex <= arr.length) {
            arr.splice(newIndex, 0, imageId)
          } else {
            arr.push(imageId)
          }
          return arr
        }

        if (to.type === 'pool') {
          pool = insertInto(pool)
        } else {
          const tier = tiers.find((t) => t.id === to.tierId)
          if (tier) {
            tier.imageIds = insertInto(tier.imageIds)
          }
        }

        return { ...prev, pool, tiers }
      })
    },
    [],
  )

  const updateTierLabel = useCallback((tierId: string, label: string) => {
    if (label.length === 0 || label.length > 20) return
    setState((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.id === tierId ? { ...t, label } : t)),
    }))
  }, [])

  const updateTierColor = useCallback((tierId: string, color: string) => {
    setState((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.id === tierId ? { ...t, color } : t)),
    }))
  }, [])

  const reset = useCallback(() => {
    setState(DEFAULT_STATE)
  }, [])

  return {
    state,
    addImage,
    removeImage,
    moveImage,
    updateTierLabel,
    updateTierColor,
    reset,
  }
}
