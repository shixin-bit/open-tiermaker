import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { emitAuthRequired } from '@/lib/api/client'

type Visibility = 'private' | 'public' | 'unlisted'

interface SharePanelProps {
  isAuthenticated: boolean
  visibility: Visibility
  shareId: string | null
  sharePasswordSet: boolean
  onVisibilityChange: (v: Visibility) => Promise<void>
  onRegenerateShareId: () => Promise<void>
  onPasswordChange: (password: string | null) => Promise<void>
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: 'private', label: '私有', desc: '仅你可见' },
  { value: 'unlisted', label: '不公开', desc: '知道链接的人可看' },
  { value: 'public', label: '公开', desc: '所有人可查看' },
]

export function SharePanel({
  isAuthenticated,
  visibility,
  shareId,
  sharePasswordSet,
  onVisibilityChange,
  onRegenerateShareId,
  onPasswordChange,
}: SharePanelProps) {
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordEnabled, setPasswordEnabled] = useState(sharePasswordSet)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shareUrl =
    shareId && visibility !== 'private' ? `${window.location.origin}/share/${shareId}` : null

  async function handleVisibilityChange(next: Visibility) {
    setSaving(true)
    setError(null)
    try {
      await onVisibilityChange(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerateLink() {
    setSaving(true)
    setError(null)
    try {
      await onRegenerateShareId()
      setCopied(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('复制失败，请手动复制')
    }
  }

  async function handleSavePassword() {
    setSaving(true)
    setError(null)
    try {
      if (passwordEnabled) {
        await onPasswordChange(password || '')
      } else {
        await onPasswordChange(null)
        setPassword('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存密码失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">🔗 分享设置</h3>

      {!isAuthenticated ? (
        <button
          type="button"
          onClick={() => emitAuthRequired()}
          className="w-full text-left rounded-md border border-dashed border-border bg-muted/30 p-4 hover:border-primary/60 hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">🔒 登录后开启分享能力</p>
              <p className="text-xs text-muted-foreground">
                设置可见性、生成分享链接、添加密码保护
              </p>
            </div>
            <span className="text-xs text-primary shrink-0 font-medium">立即登录 →</span>
          </div>
        </button>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">可见性</label>
            <div className="grid gap-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => !saving && handleVisibilityChange(opt.value)}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    visibility === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  } ${saving ? 'opacity-50' : ''}`}
                  disabled={saving}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      visibility === opt.value ? 'border-primary' : 'border-border'
                    }`}
                  >
                    {visibility === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {visibility !== 'private' && shareUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium">分享链接</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-mono"
                />
                <Button onClick={handleCopyLink} variant="outline" size="sm" disabled={saving}>
                  {copied ? '已复制' : '复制'}
                </Button>
                <Button
                  onClick={handleRegenerateLink}
                  variant="outline"
                  size="sm"
                  disabled={saving}
                >
                  重置
                </Button>
              </div>
            </div>
          )}

          {visibility !== 'private' && (
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  onChange={(e) => {
                    setPasswordEnabled(e.target.checked)
                    if (!e.target.checked) setPassword('')
                  }}
                  className="rounded border-border"
                />
                密码保护
              </label>
              {passwordEnabled && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="访问密码"
                    maxLength={32}
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSavePassword}
                    disabled={saving}
                  >
                    保存
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  )
}
