import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { api, ApiError } from '@/lib/api/client'
import { generateLocalBoardId, migrateLocalToCloud } from '@/hooks/useBoardState'
import { migrateLegacyIfNeeded, saveBoard } from '@/lib/storage'
import { DEFAULT_STATE } from '@open-tiermaker/shared'

export function NewBoardPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    try {
      if (isAuthenticated) {
        await migrateLocalToCloud()
        const board = await api.post<{ id: string }>('/boards', {
          title: title.trim(),
          description: description.trim() || null,
        })
        navigate(`/boards/${board.id}`, { replace: true })
      } else {
        migrateLegacyIfNeeded()
        const id = generateLocalBoardId()
        saveBoard({
          id,
          title: title.trim(),
          description: description.trim() || undefined,
          updatedAt: Date.now(),
          state: DEFAULT_STATE,
        })
        navigate(`/boards/local/${id}`, { replace: true })
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 p-6 rounded-lg border border-border bg-card"
      >
        <h1 className="text-xl font-bold">创建排行榜</h1>

        <div className="space-y-2">
          <Label htmlFor="title">标题 *</Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：游戏角色战力排行"
            maxLength={120}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">描述（可选）</Label>
          <Input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述这个排行榜的主题"
            maxLength={500}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={!title.trim() || loading}>
          {loading ? '创建中…' : isAuthenticated ? '创建云端排行榜' : '创建本地排行榜'}
        </Button>

        {!isAuthenticated && (
          <p className="text-xs text-muted-foreground text-center">
            提示：创建后可以随时注册账号，数据会自动迁移到云端
          </p>
        )}
      </form>
    </div>
  )
}
