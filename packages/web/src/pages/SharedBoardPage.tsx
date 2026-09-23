import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError, buildShareImageUrl } from '@/lib/api/client'
import type { CloudBoardDetail } from '@/hooks/useBoardState'
import type { Tier, ImageItem } from '@open-tiermaker/shared'
import { TierBoard } from '@/components/TierBoard'

export function SharedBoardPage() {
  const { shareId } = useParams()
  const [board, setBoard] = useState<CloudBoardDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<{
    tiers: Tier[]
    pool: string[]
    images: Record<string, ImageItem>
  } | null>(null)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [submittingPassword, setSubmittingPassword] = useState(false)
  const [submittedPassword, setSubmittedPassword] = useState<string | null>(null)

  useEffect(() => {
    if (!shareId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setPasswordRequired(false)
      try {
        const url = submittedPassword
          ? `/share/${shareId}?password=${encodeURIComponent(submittedPassword)}`
          : `/share/${shareId}`
        const data = await api.get<CloudBoardDetail>(url, { auth: false })
        if (cancelled) return
        setBoard(data)

        const images: Record<string, ImageItem> = {}
        for (const [id, img] of Object.entries(data.images)) {
          const src = img.src.startsWith('/api/')
            ? buildShareImageUrl(shareId!, id) +
              (submittedPassword ? `?password=${encodeURIComponent(submittedPassword)}` : '')
            : img.src
          images[id] = {
            id,
            src,
            source: img.source,
            createdAt: img.createdAt,
          }
        }

        const pool: string[] = []
        const tierImageSet = new Set<string>()
        for (const t of data.tiers) for (const id of t.imageIds) tierImageSet.add(id)
        for (const id of Object.keys(images)) if (!tierImageSet.has(id)) pool.push(id)

        setState({
          tiers: data.tiers.map((t) => ({ ...t })),
          pool,
          images,
        })
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setError('这个分享链接不存在或已失效')
        } else if (err instanceof ApiError && err.status === 401) {
          setPasswordRequired(true)
        } else {
          setError('加载失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [shareId, submittedPassword])

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordInput.trim()) return
    setSubmittingPassword(true)
    setError(null)
    try {
      await api.get(`/share/${shareId}?password=${encodeURIComponent(passwordInput.trim())}`, {
        auth: false,
      })
      setSubmittedPassword(passwordInput.trim())
      setPasswordRequired(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('密码错误，请重试')
      } else {
        setError('验证失败')
      }
    } finally {
      setSubmittingPassword(false)
    }
  }

  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmitPassword}
          className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-4"
        >
          <div className="text-center">
            <div className="text-4xl mb-2">🔒</div>
            <h1 className="text-xl font-semibold">这个排行榜需要密码</h1>
            <p className="text-sm text-muted-foreground mt-1">请输入分享者提供的访问密码</p>
          </div>
          <input
            type="text"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="访问密码"
            autoFocus
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            maxLength={32}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={submittingPassword || !passwordInput.trim()}
            className="w-full inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-9 px-4 hover:bg-primary/90 disabled:opacity-50"
          >
            {submittingPassword ? '验证中…' : '提交'}
          </button>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">加载中…</p>
      </div>
    )
  }

  if (error || !state || !board) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl">😵</div>
          <h1 className="text-xl font-semibold">{error ?? '无法加载'}</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-bold">{board.title}</h1>
          {board.description && (
            <p className="text-sm text-muted-foreground mt-1">{board.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">只读分享视图</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <TierBoard state={state} overContainerId={null} readOnly />
      </main>
    </div>
  )
}
