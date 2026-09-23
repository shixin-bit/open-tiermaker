import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { AuthImage } from './AuthImage'

interface ImageCardProps {
  id: string
  src: string
  onRemove: (id: string) => void
}

export function ImageCard({ id, src, onRemove }: ImageCardProps) {
  const [hovered, setHovered] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative group rounded-md overflow-hidden border border-border bg-muted shrink-0 cursor-grab active:cursor-grabbing',
        'w-24 h-24',
        isDragging && 'ring-2 ring-primary',
      )}
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
        >
          ×
        </button>
      )}
    </div>
  )
}
