import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { onAuthRequired } from '@/lib/api/client'

export function AuthModal() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const off = onAuthRequired(() => setOpen(true))
    return off
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) setOpen(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">需要登录</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          此功能需要登录后使用。登录后即可保存、同步和分享你的排行榜。
        </p>
        <div className="flex flex-col gap-2">
          <Link
            to="/login"
            state={{ from: location }}
            className="w-full inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-9 px-4 hover:bg-primary/90"
            onClick={() => setOpen(false)}
          >
            立即登录
          </Link>
          <Link
            to="/register"
            className="w-full inline-flex items-center justify-center rounded-md border border-border bg-transparent text-sm font-medium h-9 px-4 hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            免费注册
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground mt-1"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  )
}
