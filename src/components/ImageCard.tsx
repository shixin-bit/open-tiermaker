import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

interface ImageCardProps {
  id: string
  src: string
  onRemove: (id: string) => void
}

export function ImageCard({ id, src, onRemove }: ImageCardProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
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
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs text-center p-1">
          加载失败
        </div>
      ) : (
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn('w-full h-full object-cover select-none', !loaded && 'opacity-0')}
        />
      )}
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
