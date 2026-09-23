import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api/client'
import type { CloudBoardSummary } from '@/hooks/useBoardState'
import {
  loadAllBoards,
  deleteBoard as deleteLocalBoard,
  migrateLegacyIfNeeded,
} from '@/lib/storage'

interface Props {
  variant?: 'cloud' | 'local' | 'all'
}

export function BoardListPage({ variant = 'all' }: Props) {
  const { isAuthenticated, user, logout, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [cloudBoards, setCloudBoards] = useState<CloudBoardSummary[]>([])
  const [localBoards, setLocalBoards] = useState<ReturnType<typeof loadAllBoards>>(() => {
    const migrated = migrateLegacyIfNeeded()
    return migrated.length > 0 ? migrated : loadAllBoards()
  })
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchCloud() {
      if (!isAuthenticated) {
        setCloudBoards([])
        setLoading(false)
        return
      }
      try {
        const boards = await api.get<CloudBoardSummary[]>('/boards')
        if (!cancelled) setCloudBoards(boards)
      } catch {
        // session might have expired
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCloud()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  async function handleDelete(boardId: string, isCloudBoard: boolean) {
    if (!confirm('确定要删除这个排行榜吗？此操作不可恢复。')) return
    setDeleting(boardId)
    try {
      if (isCloudBoard) {
        await api.del(`/boards/${boardId}`)
        setCloudBoards((prev) => prev.filter((b) => b.id !== boardId))
      } else {
        deleteLocalBoard(boardId)
        setLocalBoards((prev) => prev.filter((b) => b.id !== boardId))
      }
    } finally {
      setDeleting(null)
    }
  }

  const showCloud = isAuthenticated && (variant === 'cloud' || variant === 'all')
  const showLocal = !isAuthenticated || variant === 'local' || variant === 'all'
  const totalCount = (showCloud ? cloudBoards.length : 0) + (showLocal ? localBoards.length : 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold hover:opacity-80">
              Open TierMaker
            </Link>
            {isAuthenticated && user && (
              <span className="text-sm text-muted-foreground">{user.username ?? user.email}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                登出
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">登录</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">注册</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{isAuthenticated ? '我的排行榜' : '本地排行榜'}</h2>
          <Button asChild>
            <Link to="/boards/new">+ 新建排行榜</Link>
          </Button>
        </div>

        {loading || authLoading ? (
          <p className="text-muted-foreground">加载中…</p>
        ) : totalCount === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-4">
            <div className="text-4xl">📊</div>
            <div>
              <h3 className="font-semibold text-lg">还没有排行榜</h3>
              <p className="text-muted-foreground text-sm">点击上方"新建排行榜"开始创作吧</p>
            </div>
            {!isAuthenticated && (
              <div className="text-sm text-muted-foreground">
                提示：登录后数据自动同步云端，换设备也能继续
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {showCloud && cloudBoards.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  云端排行榜
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cloudBoards.map((board) => (
                    <BoardCard
                      key={board.id}
                      id={board.id}
                      title={board.title}
                      description={board.description}
                      updatedAt={new Date(board.updatedAt).getTime()}
                      itemCount={board._count?.items ?? 0}
                      visibility={board.visibility}
                      onDelete={() => handleDelete(board.id, true)}
                      isDeleting={deleting === board.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {showLocal && localBoards.length > 0 && (
              <section className="space-y-3">
                {isAuthenticated && (
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    本地排行榜（未迁移）
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {localBoards.map((board) => (
                    <BoardCard
                      key={board.id}
                      id={board.id}
                      title={board.title}
                      description={board.description}
                      updatedAt={board.updatedAt}
                      itemCount={Object.keys(board.state.images).length}
                      visibility="private"
                      onDelete={() => handleDelete(board.id, false)}
                      isDeleting={deleting === board.id}
                      onEdit={() => navigate(`/boards/local/${board.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

interface BoardCardProps {
  id: string
  title: string
  description?: string | null
  updatedAt: number
  itemCount: number
  visibility: 'private' | 'public' | 'unlisted'
  onDelete: () => void
  isDeleting: boolean
  onEdit?: () => void
}

function BoardCard({
  id,
  title,
  description,
  updatedAt,
  itemCount,
  visibility,
  onDelete,
  isDeleting,
  onEdit,
}: BoardCardProps) {
  const to: string = onEdit ? '/boards/local/' + id : `/boards/${id}`
  return (
    <div className="group rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors">
      <Link to={to} className="block">
        <h4 className="font-semibold line-clamp-1">{title}</h4>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{description}</p>
        )}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <span>{itemCount} 个条目</span>
          <span>·</span>
          <span>{new Date(updatedAt).toLocaleString()}</span>
        </div>
        <div className="mt-2">
          <VisibilityBadge visibility={visibility} />
        </div>
      </Link>
      <div className="mt-3 pt-3 border-t border-border flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive/80"
          onClick={(e) => {
            e.preventDefault()
            onDelete()
          }}
          disabled={isDeleting}
        >
          {isDeleting ? '删除中…' : '删除'}
        </Button>
      </div>
    </div>
  )
}

function VisibilityBadge({ visibility }: { visibility: 'private' | 'public' | 'unlisted' }) {
  const labels = {
    private: { text: '私有', cls: 'bg-muted text-muted-foreground' },
    public: { text: '公开', cls: 'bg-green-500/10 text-green-600' },
    unlisted: { text: '不公开', cls: 'bg-amber-500/10 text-amber-600' },
  } as const
  const cfg = labels[visibility]
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.text}</span>
}
