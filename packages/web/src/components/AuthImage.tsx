import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { getAccessToken } from '@/lib/tokens'

interface AuthImageProps {
  src: string
  alt?: string
  className?: string
  draggable?: boolean
  onLoad?: () => void
  onError?: () => void
}

function isApiPath(src: string): boolean {
  return src.startsWith('/api/') || (src.startsWith('http') && src.includes('/api/'))
}

export function AuthImage({
  src,
  alt = '',
  className,
  draggable = false,
  onLoad,
  onError,
}: AuthImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string>(src)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const blobRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      setLoaded(false)
      setError(false)

      if (!isApiPath(src)) {
        setResolvedSrc(src)
        return
      }

      const token = getAccessToken()
      if (!token) {
        setResolvedSrc(src)
        return
      }

      try {
        const res = await fetch(src, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return
        if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          blobRef.current = url
          setResolvedSrc(url)
        } else {
          setResolvedSrc(src)
        }
      } catch {
        if (!cancelled) setResolvedSrc(src)
      }
    }

    resolve()
    return () => {
      cancelled = true
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
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
          src={resolvedSrc}
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
