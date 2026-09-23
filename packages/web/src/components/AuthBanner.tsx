import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const DISMISS_KEY = 'otm:banner:auth-dismissed'
const BOARDS_KEY = 'otm:boards'

function hasLocalBoards(): boolean {
  try {
    const raw = localStorage.getItem(BOARDS_KEY)
    if (!raw) return false
    const arr = JSON.parse(raw)
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

export function AuthBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [localBoards, setLocalBoards] = useState(() => hasLocalBoards())

  useEffect(() => {
    function handleStorage() {
      setLocalBoards(hasLocalBoards())
    }
    window.addEventListener('storage', handleStorage)
    const id = setInterval(handleStorage, 1500)
    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(id)
    }
  }, [])

  if (dismissed) return null
  if (localBoards) return null

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-6 py-2">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-foreground flex-1">
          <span className="font-medium">开启云端保存 & 分享能力 —— </span>
          <Link to="/register" className="underline hover:opacity-80">
            免费注册账号 →
          </Link>
        </p>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-accent"
          aria-label="关闭提示"
        >
          ×
        </button>
      </div>
    </div>
  )
}
