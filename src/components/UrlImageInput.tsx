import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface UrlImageInputProps {
  onAdd: (src: string, source: 'local' | 'url') => void
}

export function UrlImageInput({ onAdd }: UrlImageInputProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isValidImageUrl = async (urlStr: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = urlStr
    })
  }

  const handleAdd = async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setError(null)
    setLoading(true)

    try {
      const parsed = new URL(trimmed)
      if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
        setError('只支持 http/https URL')
        setLoading(false)
        return
      }
      const ok = await isValidImageUrl(trimmed)
      if (!ok) {
        setError('无法加载该 URL 的图片，请确认地址是否正确')
        setLoading(false)
        return
      }
      onAdd(trimmed, 'url')
      setUrl('')
    } catch {
      setError('无效的 URL 格式')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="粘贴图片 URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          disabled={loading}
        />
        <Button type="button" onClick={handleAdd} disabled={loading || !url.trim()}>
          {loading ? '加载中...' : '添加'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
