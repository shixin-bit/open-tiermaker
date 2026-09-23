import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api/client'
import { setTokens, clearTokens, getRefreshToken } from '@/lib/tokens'

export interface User {
  id: string
  email: string
  username: string | null
  avatarUrl: string | null
}

interface SessionResponse {
  user: User | null
}

interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

interface AuthState {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  })

  const fetchSession = useCallback(async () => {
    try {
      const res = await api.get<SessionResponse>('/auth/session')
      return { user: res.user, isAuthenticated: !!res.user }
    } catch {
      return { user: null, isAuthenticated: false }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchSession().then((result) => {
      if (!cancelled) setState({ ...result, loading: false })
    })
    return () => {
      cancelled = true
    }
  }, [fetchSession])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password })
    setTokens(res.accessToken, res.refreshToken)
    setState({ user: res.user, loading: false, isAuthenticated: true })
    return res.user
  }, [])

  const register = useCallback(async (email: string, password: string, username?: string) => {
    const res = await api.post<AuthResponse>('/auth/register', { email, password, username })
    setTokens(res.accessToken, res.refreshToken)
    setState({ user: res.user, loading: false, isAuthenticated: true })
    return res.user
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken }, { skipRefresh: true, auth: false })
      } catch {
        // best effort
      }
    }
    clearTokens()
    setState({ user: null, loading: false, isAuthenticated: false })
  }, [])

  const completeOAuth = useCallback(async (refreshTokenParam: string) => {
    clearTokens()
    const res = await api.post<AuthResponse>(
      '/auth/refresh',
      { refreshToken: refreshTokenParam },
      { skipRefresh: true, auth: false },
    )
    setTokens(res.accessToken, res.refreshToken)
    setState({ user: res.user, loading: false, isAuthenticated: true })
    return res.user
  }, [])

  return { ...state, login, register, logout, completeOAuth, refresh: fetchSession }
}

export { ApiError }
