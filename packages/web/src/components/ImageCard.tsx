import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { AuthImage } from './AuthImage'

interface ImageCardProps {
  id: string
  src: string
  onRemove: (id: string) => void
  /** 是否处于选中态(选中时显示 ring 描边,Delete 可批量删除) */
  selected?: boolean
  /** 点击图片选中/累积选中(Shift+点击)回调 */
  onSelect?: (id: string, shiftKey: boolean) => void
}

export function ImageCard({ id, src, onRemove, selected = false, onSelect }: ImageCardProps) {
  const [hovered, setHovered] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        // 拖拽中不触发选中(dnd-kit 在 mousemove > 5px 时已激活 drag,
        // 此情况 onClick 不会 fire;但保险起见仍判断 isDragging)
        if (isDragging) return
        // 阻止冒泡到 TierRow / ImagePool 外层的"点击空白清空选中"逻辑
        e.stopPropagation()
        onSelect?.(id, e.shiftKey)
      }}
      className={cn(
        'relative group rounded-md overflow-hidden border border-border bg-muted shrink-0 cursor-grab active:cursor-grabbing transition-all duration-150',
        'w-24 h-24',
        isDragging && 'opacity-50 ring-2 ring-primary/50',
        selected && 'ring-2 ring-primary ring-offset-2',
      )}
      aria-pressed={selected}
      aria-label={selected ? '取消选中图片' : '选中图片'}
      role="button"
      data-image-id={id}
    >
      <AuthImage src={src} draggable={false} />
      {hovered && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(id)
          }}
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center hover:bg-destructive/80 z-10"
          title="删除"
          aria-label="删除图片"
        >
          ×
        </button>
      )}
    </div>
  )
}
