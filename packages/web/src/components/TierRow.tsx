import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import type { Tier } from '@/lib/types'
import { TierLabel } from './TierLabel'
import { ImageCard } from './ImageCard'
import { cn } from '@/lib/utils'

interface TierRowProps {
  tier: Tier
  imageSrcs: Record<string, string>
  onRemoveImage: (id: string) => void
  onLabelChange: (tierId: string, label: string) => void
  onColorChange: (tierId: string, color: string) => void
  isOver: boolean
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function TierRow({
  tier,
  imageSrcs,
  onRemoveImage,
  onLabelChange,
  onColorChange,
  isOver,
}: TierRowProps) {
  const { setNodeRef, isOver: droppableIsOver } = useDroppable({ id: `tier-${tier.id}` })

  return (
    <div
      className="flex border border-border rounded-md overflow-hidden"
      style={{ backgroundColor: hexToRgba(tier.color, 0.08) }}
    >
      <TierLabel
        label={tier.label}
        color={tier.color}
        onLabelChange={(label) => onLabelChange(tier.id, label)}
        onColorChange={(color) => onColorChange(tier.id, color)}
      />
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 flex flex-wrap items-start content-start gap-2 p-3 min-h-[110px] transition-colors',
          (isOver || droppableIsOver) && 'ring-2 ring-inset ring-primary/60 bg-white/40',
        )}
      >
        {tier.imageIds.length === 0 && (
          <span className="text-muted-foreground text-sm select-none">拖拽图片到这里</span>
        )}
        <SortableContext items={tier.imageIds} strategy={verticalListSortingStrategy}>
          {tier.imageIds.map((imgId) => (
            <ImageCard
              key={imgId}
              id={imgId}
              src={imageSrcs[imgId] || ''}
              onRemove={onRemoveImage}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
