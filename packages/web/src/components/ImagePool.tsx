import { SortableContext } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { ImageCard } from './ImageCard'
import { cn } from '@/lib/utils'

interface ImagePoolProps {
  poolIds: string[]
  imageSrcs: Record<string, string>
  onRemoveImage: (id: string) => void
  isOver: boolean
  /** 当前选中集合,透传给内部 ImageCard */
  selectedIds?: Set<string>
  /** 图片点击/Shift+点击 选中回调,透传给内部 ImageCard */
  onImageSelect?: (id: string, shiftKey: boolean) => void
  /** 点击空白区域清空选中的回调 */
  onBackgroundClick?: () => void
}

export function ImagePool({
  poolIds,
  imageSrcs,
  onRemoveImage,
  isOver,
  selectedIds,
  onImageSelect,
  onBackgroundClick,
}: ImagePoolProps) {
  const { setNodeRef } = useDroppable({ id: 'pool' })

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        // 仅当点击目标就是外层容器时才清空选中
        if (e.target === e.currentTarget) {
          onBackgroundClick?.()
        }
      }}
      className={cn(
        'border border-dashed border-border rounded-lg p-4 min-h-[120px] transition-colors',
        isOver && 'border-2 border-primary bg-primary/5',
      )}
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-2">图片池（未分配）</h3>
      <div className="flex flex-wrap gap-2">
        {poolIds.length === 0 ? (
          <span className="text-muted-foreground text-sm select-none">添加图片后会出现在这里</span>
        ) : (
          <SortableContext items={poolIds}>
            {poolIds.map((id) => (
              <ImageCard
                key={id}
                id={id}
                src={imageSrcs[id] || ''}
                onRemove={onRemoveImage}
                selected={selectedIds?.has(id) ?? false}
                onSelect={onImageSelect}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
