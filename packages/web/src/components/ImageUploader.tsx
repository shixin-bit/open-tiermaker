import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024
const MAX_WIDTH = 1200

interface ImageUploaderProps {
  boardId?: string | null
  isAuthenticated?: boolean
  onAdd: (src: string, source: 'local' | 'url', imgId?: string) => void
}

export function ImageUploader({ boardId, isAuthenticated, onAdd }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const compressImage = (file: File): Promise<{ blob: Blob; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let { width, height } = img
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width))
            width = MAX_WIDTH
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('无法创建 canvas'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('图片压缩失败'))
                return
              }
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
              resolve({ blob, dataUrl })
            },
            'image/jpeg',
            0.85,
          )
        }
        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
  }

  const useCloudUpload = isAuthenticated && !!boardId

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setError(null)
    setUploading(true)
    const total = files.length
    let done = 0

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`不支持的格式: ${file.name}`)
        done++
        setProgress(Math.round((done / total) * 100))
        continue
      }
      if (file.size > MAX_SIZE) {
        setError(`文件过大（>10MB）: ${file.name}`)
        done++
        setProgress(Math.round((done / total) * 100))
        continue
      }
      try {
        setProgress(Math.round((done / total) * 50))
        const { blob, dataUrl } = await compressImage(file)

        if (useCloudUpload) {
          setProgress(Math.round(50 + (done / total) * 50))
          const uploaded = await api.upload<{ id: string }>(
            `/boards/${boardId}/images`,
            new File([blob], file.name, { type: 'image/jpeg' }),
            'file',
          )
          const src = `/api/boards/${boardId}/images/${uploaded.id}`
          onAdd(src, 'local', uploaded.id)
        } else {
          onAdd(dataUrl, 'local')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '未知错误'
        setError(`处理失败 ${file.name}: ${msg}`)
      }
      done++
      setProgress(Math.round((done / total) * 100))
    }

    setTimeout(() => {
      setUploading(false)
      setProgress(0)
    }, 500)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (!uploading) handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
          uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        )}
      >
        <p className="text-sm text-muted-foreground">
          {uploading ? '上传中…' : '点击选择文件 或 拖拽图片到此处'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          支持 PNG / JPG / GIF / WEBP，单文件 ≤10MB
          {useCloudUpload && <span className="text-primary"> · 云端上传</span>}
        </p>
        {uploading && (
          <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="button"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? '上传中…' : '上传图片'}
      </Button>
    </div>
  )
}
