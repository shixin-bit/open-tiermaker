import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AuthImageProps {
  src: string
  alt?: string
  className?: string
  draggable?: boolean
  onLoad?: () => void
  onError?: () => void
}

export function AuthImage({
  src,
  alt = '',
  className,
  draggable = false,
  onLoad,
  onError,
}: AuthImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [prevSrc, setPrevSrc] = useState(src)
  const imgRef = useRef<HTMLImageElement>(null)

  // src 变化时重置状态（React 19 render 期间设 state 模式，避免 effect 级联渲染）
  if (prevSrc !== src) {
    setPrevSrc(src)
    setLoaded(false)
    setError(false)
  }

  // data URL 或缓存图片可能在 React 挂载 onLoad 监听器之前就已加载完成，
  // 导致 onLoad 永不触发。这里在 src 变化后检查 img.complete。
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [src])

  return (
    <>
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
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={draggable}
          onLoad={() => {
            setLoaded(true)
            onLoad?.()
          }}
          onError={() => {
            setError(true)
            onError?.()
          }}
          className={cn(
            'w-full h-full object-cover select-none',
            !loaded && 'opacity-0',
            className,
          )}
        />
      )}
    </>
  )
}
