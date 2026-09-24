import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { onAuthRequired } from '@/lib/api/client'
import { useAuth, ApiError } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthModal() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { login, isAuthenticated } = useAuth()
  const prevAuthRef = useRef(isAuthenticated)

  useEffect(() => {
    const off = onAuthRequired((force: boolean) => {
      // API 401 触发的（force=false）在用户已关闭弹窗后不再自动弹出；
      // 用户手动点击"立即登录"（force=true）始终打开
      if (force || !dismissed) {
        setOpen(true)
        setDismissed(false)
      }
    })
    return off
  }, [dismissed])

  // 仅在认证状态从 false→true（刚登录成功）时关闭弹窗，
  // 避免用户已有 refresh cookie 时打开弹窗即闪退
  useEffect(() => {
    if (isAuthenticated && open && !prevAuthRef.current) {
      setOpen(false)
      setEmail('')
      setPassword('')
      setError(null)
    }
    prevAuthRef.current = isAuthenticated
  }, [isAuthenticated, open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      setOpen(false)
      setEmail('')
      setPassword('')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('登录失败，请检查网络后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  function close() {
    setOpen(false)
    setError(null)
    setDismissed(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">登录</h3>
          <button
            type="button"
            onClick={close}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth-modal-email">邮箱</Label>
            <Input
              id="auth-modal-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-modal-password">密码</Label>
            <Input
              id="auth-modal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs">
          <span className="text-muted-foreground">没有账号？</span>{' '}
          <Link to="/register" onClick={close} className="text-primary hover:underline">
            立即注册
          </Link>
        </div>
      </div>
    </div>
  )
}
