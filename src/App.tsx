import { useRef, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { TierBoard } from '@/components/TierBoard'
import { ImagePool } from '@/components/ImagePool'
import { ImageUploader } from '@/components/ImageUploader'
import { UrlImageInput } from '@/components/UrlImageInput'
import { ExportButton } from '@/components/ExportButton'
import { useTierState } from '@/hooks/useTierState'

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

export default function App() {
  const boardRef = useRef<HTMLDivElement>(null)
  const { state, addImage, removeImage, moveImage, updateTierLabel, updateTierColor, reset } =
    useTierState()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overContainerId, setOverContainerId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Open TierMaker</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('确定要重置所有数据吗？')) reset()
              }}
            >
              重置
            </Button>
            <ExportButton targetRef={boardRef} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <section className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">添加本地图片</h2>
            <ImageUploader onAdd={(src, source) => addImage(src, source)} />
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
      </main>
    </div>
  )
}
