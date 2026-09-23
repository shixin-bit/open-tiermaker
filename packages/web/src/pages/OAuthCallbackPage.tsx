import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { migrateLocalToCloud } from '@/hooks/useBoardState'

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { completeOAuth } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handle() {
      const refreshToken = searchParams.get('refresh')
      if (!refreshToken) {
        setError('没有收到登录凭证')
        setTimeout(() => navigate('/login', { replace: true }), 2000)
        return
      }

      try {
        await completeOAuth(refreshToken)
        try {
          await migrateLocalToCloud()
        } catch {
          // ignore migration errors
        }
        navigate('/boards', { replace: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : '登录失败'
        setError(msg)
        setTimeout(() => navigate('/login', { replace: true }), 2000)
      }
    }

    handle()
  }, [searchParams, navigate, completeOAuth])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        {error ? (
          <p className="text-destructive">{error}</p>
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
