import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError } from '@/lib/api/client'
import { setTokens, clearTokens } from '@/lib/tokens'

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

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, username?: string) => Promise<User>
  logout: () => Promise<void>
  completeOAuth: (refreshTokenParam: string) => Promise<User>
  refresh: () => Promise<{ user: User | null; isAuthenticated: boolean }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  })
  const sessionGenRef = useRef(0)

  const fetchSession = useCallback(async () => {
    try {
      const res = await api.get<SessionResponse>('/auth/session')
      return { user: res.user, isAuthenticated: !!res.user }
    } catch {
      return { user: null, isAuthenticated: false }
    }
  }, [])

  useEffect(() => {
    const gen = sessionGenRef.current
    fetchSession().then((result) => {
      if (sessionGenRef.current === gen) {
        setState({ ...result, loading: false })
      }
    })
  }, [fetchSession])

  const refresh = useCallback(async () => {
    const gen = sessionGenRef.current
    const result = await fetchSession()
    if (sessionGenRef.current === gen) {
      setState({ ...result, loading: false })
    }
    return result
  }, [fetchSession])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password })
    sessionGenRef.current++
    setTokens(res.accessToken, res.refreshToken)
    setState({ user: res.user, loading: false, isAuthenticated: true })
    return res.user
  }, [])

  const register = useCallback(async (email: string, password: string, username?: string) => {
    const res = await api.post<AuthResponse>('/auth/register', { email, password, username })
    sessionGenRef.current++
    setTokens(res.accessToken, res.refreshToken)
    setState({ user: res.user, loading: false, isAuthenticated: true })
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, { skipRefresh: true, auth: false })
    } catch {
      // best effort
    }
    sessionGenRef.current++
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
    sessionGenRef.current++
    setTokens(res.accessToken, res.refreshToken)
    setState({ user: res.user, loading: false, isAuthenticated: true })
    return res.user
  }, [])

  return { ...state, login, register, logout, completeOAuth, refresh }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { ApiError }
