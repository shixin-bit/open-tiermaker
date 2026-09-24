import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { migrateLocalToCloud } from '@/hooks/useBoardState'

export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()
  const showAuthError = !loading && !isAuthenticated

  useEffect(() => {
    if (loading) return

    if (isAuthenticated) {
      // 后端已通过 Set-Cookie 写入 HttpOnly Cookie，useAuth 自动刷新获取了 access token
      migrateLocalToCloud()
        .catch(() => {
          // best effort
        })
        .finally(() => {
          navigate('/boards', { replace: true })
        })
    } else {
      // 刷新失败（cookie 无效或过期），2 秒后跳转登录页
      const timer = setTimeout(() => navigate('/login', { replace: true }), 2000)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, loading, navigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        {showAuthError ? (
          <p className="text-destructive">登录失败，请重试</p>
        ) : (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
            <p className="text-muted-foreground">正在完成登录…</p>
          </>
        )}
      </div>
    </div>
  )
}
