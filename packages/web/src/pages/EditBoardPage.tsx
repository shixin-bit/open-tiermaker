import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TierBoard } from '@/components/TierBoard'
import { ImagePool } from '@/components/ImagePool'
import { ImageUploader } from '@/components/ImageUploader'
import { UrlImageInput } from '@/components/UrlImageInput'
import { ExportButton } from '@/components/ExportButton'
import { SharePanel } from '@/components/SharePanel'
import { useAuth } from '@/hooks/useAuth'
import { useBoardState } from '@/hooks/useBoardState'
import { useLocalStorageSize } from '@/hooks/useLocalStorageSize'
import type { ImageItem, TierState } from '@open-tiermaker/shared'

function getContainerOfImage(
  imageId: string,
  tiers: { id: string; imageIds: string[] }[],
  pool: string[],
): string | null {
  if (pool.includes(imageId)) return 'pool'
  for (const t of tiers) {
    if (t.imageIds.includes(imageId)) return `tier-${t.id}`
  }
  return null
}

function getContainerItemIds(
  containerId: string | null,
  tiers: { id: string; imageIds: string[] }[],
  pool: string[],
): string[] {
  if (!containerId) return []
  if (containerId === 'pool') return pool
  const tierId = containerId.replace('tier-', '')
  const tier = tiers.find((t) => t.id === tierId)
  return tier ? tier.imageIds : []
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

interface Props {
  boardId?: string | null
  forceLocal?: boolean
}

export function EditBoardPage({ boardId: explicitBoardId, forceLocal }: Props) {
  const params = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const boardId = explicitBoardId ?? params.id ?? null
  const effectiveAuth = forceLocal ? false : isAuthenticated

  const boardRef = useRef<HTMLDivElement>(null)
  const {
    state,
    setState,
    title,
    setTitle,
    loading,
    loaded,
    save,
    isSaving,
    isCloud,
    visibility,
    shareId,
    sharePasswordSet,
    updateVisibility,
    regenerateShareId,
    updateSharePassword,
  } = useBoardState(boardId, effectiveAuth)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overContainerId, setOverContainerId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const { mb, warning: storageWarning } = useLocalStorageSize()

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const addImage = useCallback(
    (src: string, source: 'local' | 'url', cloudId?: string) => {
      const id = cloudId ?? generateId()
      const image: ImageItem = { id, src, source, createdAt: Date.now() }
      setState((prev: TierState) => ({
        ...prev,
        images: { ...prev.images, [id]: image },
        pool: [...prev.pool, id],
      }))
    },
    [setState],
  )

  const removeImage = useCallback(
    (imageId: string) => {
      setState((prev: TierState) => {
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
    },
    [setState],
  )

  const moveImage = useCallback(
    (
      imageId: string,
      from: { type: 'pool' } | { type: 'tier'; tierId: string },
      to: { type: 'pool' } | { type: 'tier'; tierId: string },
      newIndex?: number,
    ) => {
      setState((prev: TierState) => {
        let pool = [...prev.pool]
        const tiers = prev.tiers.map((t) => ({ ...t, imageIds: [...t.imageIds] }))

        if (from.type === 'pool') {
          pool = pool.filter((id) => id !== imageId)
        } else {
          const tier = tiers.find((t) => t.id === from.tierId)
          if (tier) tier.imageIds = tier.imageIds.filter((id) => id !== imageId)
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
          if (tier) tier.imageIds = insertInto(tier.imageIds)
        }

        return { ...prev, pool, tiers }
      })
    },
    [setState],
  )

  const updateTierLabel = useCallback(
    (tierId: string, label: string) => {
      if (label.length === 0 || label.length > 20) return
      setState((prev: TierState) => ({
        ...prev,
        tiers: prev.tiers.map((t) => (t.id === tierId ? { ...t, label } : t)),
      }))
    },
    [setState],
  )

  const updateTierColor = useCallback(
    (tierId: string, color: string) => {
      setState((prev: TierState) => ({
        ...prev,
        tiers: prev.tiers.map((t) => (t.id === tierId ? { ...t, color } : t)),
      }))
    },
    [setState],
  )

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      await save(state, title)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [save, state, title])

  const handleReset = useCallback(() => {
    if (confirm('确定要重置所有数据吗？')) {
      setState({
        tiers: state.tiers.map((t) => ({ ...t, imageIds: [] })),
        pool: [],
        images: {},
      })
    }
  }, [setState, state.tiers])

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const handleDragOver = (e: DragOverEvent) => {
    const over = e.over
    if (!over) {
      setOverContainerId(null)
      return
    }
    const overId = String(over.id)
    if (overId === 'pool' || overId.startsWith('tier-')) {
      setOverContainerId(overId)
    } else {
      const containerId = getContainerOfImage(overId, state.tiers, state.pool)
      setOverContainerId(containerId)
    }
  }
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    const activeIdStr = String(active.id)
    setActiveId(null)
    setOverContainerId(null)
    if (!over) return
    const overIdStr = String(over.id)

    let toContainer: { type: 'pool' } | { type: 'tier'; tierId: string } | null = null
    let newIndex: number | undefined

    if (overIdStr === 'pool') {
      toContainer = { type: 'pool' }
    } else if (overIdStr.startsWith('tier-')) {
      toContainer = { type: 'tier', tierId: overIdStr.replace('tier-', '') }
    } else {
      const overContainer = getContainerOfImage(overIdStr, state.tiers, state.pool)
      if (!overContainer) return
      if (overContainer === 'pool') {
        toContainer = { type: 'pool' }
      } else {
        toContainer = { type: 'tier', tierId: overContainer.replace('tier-', '') }
      }
      const items = getContainerItemIds(overContainer, state.tiers, state.pool)
      newIndex = items.indexOf(overIdStr)
    }
    if (!toContainer) return

    const fromContainer = getContainerOfImage(activeIdStr, state.tiers, state.pool)
    if (!fromContainer) return
    const from =
      fromContainer === 'pool'
        ? { type: 'pool' as const }
        : { type: 'tier' as const, tierId: fromContainer.replace('tier-', '') }

    let finalIndex = newIndex
    if (finalIndex === undefined) {
      if (toContainer.type === 'pool') {
        finalIndex = state.pool.filter((id) => id !== activeIdStr).length
      } else {
        const tier = state.tiers.find((t) => t.id === toContainer.tierId)
        finalIndex = tier?.imageIds.filter((id) => id !== activeIdStr).length ?? 0
      }
    } else {
      const sourceContainer = fromContainer
      const targetContainer = toContainer.type === 'pool' ? 'pool' : `tier-${toContainer.tierId}`
      if (sourceContainer === targetContainer) {
        if (sourceContainer === 'pool') {
          const origIdx = state.pool.indexOf(activeIdStr)
          if (origIdx !== -1 && finalIndex > origIdx) finalIndex -= 1
        } else {
          const origTier = state.tiers.find((t) => t.id === sourceContainer.replace('tier-', ''))
          if (origTier) {
            const origIdx = origTier.imageIds.indexOf(activeIdStr)
            if (origIdx !== -1 && finalIndex > origIdx) finalIndex -= 1
          }
        }
      }
    }

    moveImage(activeIdStr, from, toContainer, finalIndex)
  }

  const activeImage = activeId ? state.images[activeId] : null

  useEffect(() => {
    if (loaded && !boardId && isCloud) {
      navigate('/boards', { replace: true })
    }
  }, [loaded, boardId, isCloud, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">加载中…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link to="/boards" className="text-xl font-bold hover:opacity-80 shrink-0">
              ←
            </Link>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-lg font-semibold border-none outline-none flex-1 min-w-0 truncate"
              placeholder="未命名排行榜"
              maxLength={120}
            />
            {isCloud && !isAuthenticated && (
              <span className="text-xs text-muted-foreground shrink-0">本地模式</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isCloud && (
              <>
                {saveStatus === 'saved' && <span className="text-sm text-green-600">已保存</span>}
                {saveStatus === 'error' && (
                  <span className="text-sm text-destructive">保存失败</span>
                )}
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                  {saveStatus === 'saving' ? '保存中…' : '保存'}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleReset}>
              重置
            </Button>
            <ExportButton targetRef={boardRef} />
          </div>
        </div>
      </header>

      {!isCloud && storageWarning && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 text-sm">
            <span className="text-amber-700">
              ⚠️ 本地存储已使用 {mb.toFixed(1)}MB / 5MB，数据可能丢失。
              <Link to="/register" className="underline ml-1 font-medium">
                注册账号云端保存 →
              </Link>
            </span>
            <div className="w-32 h-1.5 bg-amber-500/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${Math.min(100, (mb / 5) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <section className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">添加本地图片</h2>
            <ImageUploader
              boardId={boardId}
              isAuthenticated={effectiveAuth}
              onAdd={(src, source, cloudId) => addImage(src, source, cloudId)}
            />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">添加 URL 图片</h2>
            <UrlImageInput onAdd={(src, source) => addImage(src, source)} />
          </div>
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveId(null)
            setOverContainerId(null)
          }}
        >
          <section>
            <TierBoard
              ref={boardRef}
              state={state}
              onRemoveImage={removeImage}
              onLabelChange={updateTierLabel}
              onColorChange={updateTierColor}
              overContainerId={overContainerId}
            />
          </section>

          <section>
            <ImagePool
              poolIds={state.pool}
              imageSrcs={Object.fromEntries(
                Object.values(state.images).map((img) => [img.id, img.src]),
              )}
              onRemoveImage={removeImage}
              isOver={overContainerId === 'pool'}
            />
          </section>

          <DragOverlay dropAnimation={null}>
            {activeId && activeImage ? (
              <div className="w-24 h-24 rounded-md overflow-hidden border-2 border-primary shadow-xl bg-card">
                <img
                  src={activeImage.src}
                  alt=""
                  draggable={false}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {boardId && (
          <SharePanel
            isAuthenticated={isAuthenticated}
            visibility={visibility ?? 'private'}
            shareId={shareId ?? null}
            sharePasswordSet={sharePasswordSet ?? false}
            onVisibilityChange={updateVisibility}
            onRegenerateShareId={regenerateShareId}
            onPasswordChange={updateSharePassword}
          />
        )}
      </main>
    </div>
  )
}
