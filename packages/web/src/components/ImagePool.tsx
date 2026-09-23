import { SortableContext } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { ImageCard } from './ImageCard'
import { cn } from '@/lib/utils'

interface ImagePoolProps {
  poolIds: string[]
  imageSrcs: Record<string, string>
  onRemoveImage: (id: string) => void
  isOver: boolean
}

export function ImagePool({ poolIds, imageSrcs, onRemoveImage, isOver }: ImagePoolProps) {
  const { setNodeRef } = useDroppable({ id: 'pool' })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border border-dashed border-border rounded-lg p-4 min-h-[120px] transition-colors',
        isOver && 'bg-primary/5 ring-2 ring-dashed ring-primary/30',
      )}
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-2">图片池（未分配）</h3>
      <div className="flex flex-wrap gap-2">
        {poolIds.length === 0 ? (
          <span className="text-muted-foreground text-sm select-none">添加图片后会出现在这里</span>
        ) : (
          <SortableContext items={poolIds}>
            {poolIds.map((id) => (
              <ImageCard key={id} id={id} src={imageSrcs[id] || ''} onRemove={onRemoveImage} />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
