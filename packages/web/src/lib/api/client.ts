import { getAccessToken, setAccessToken, clearTokens } from '@/lib/tokens'

const BASE_URL = '/api'

const AUTH_REQUIRED_EVENT = 'auth:required'

export function emitAuthRequired(force = false) {
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail: { force } }))
}

export function onAuthRequired(handler: (force: boolean) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent).detail?.force ?? false)
  window.addEventListener(AUTH_REQUIRED_EVENT, listener)
  return () => window.removeEventListener(AUTH_REQUIRED_EVENT, listener)
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    let msg: string
    if (
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
    ) {
      msg = (data as { message: string }).message
    } else {
      msg = `HTTP ${status}`
    }
    super(msg)
    this.status = status
    this.data = data
  }
}

interface RequestOptions extends RequestInit {
  auth?: boolean
  skipRefresh?: boolean
}

async function doRequest(url: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  if (options.auth !== false) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, { ...options, headers, credentials: 'include' })
}

async function handleRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return false
    const data = (await res.json()) as { accessToken: string }
    setAccessToken(data.accessToken)
    return true
  } catch {
    return false
  }
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const res = await doRequest(url, options)

  if (res.status === 401 && !options.skipRefresh) {
    const refreshed = await handleRefresh()
    if (refreshed) {
      const retry = await doRequest(url, { ...options, skipRefresh: true })
      if (!retry.ok) {
        const data = await retry.json().catch(() => retry.statusText)
        throw new ApiError(retry.status, data)
      }
      if (retry.status === 204) return undefined as T
      return (await retry.json()) as T
    } else {
      clearTokens()
      emitAuthRequired()
      throw new ApiError(401, { message: 'Session expired' })
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => res.statusText)
    throw new ApiError(res.status, data)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  del: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  upload: <T>(path: string, file: File, fieldName = 'file', options?: RequestOptions) => {
    const form = new FormData()
    form.append(fieldName, file)
    return request<T>(path, { ...options, method: 'POST', body: form })
  },
}

export function buildImageUrl(boardId: string, imgId: string): string {
  return `${BASE_URL}/boards/${boardId}/images/${imgId}`
}

export function buildShareImageUrl(shareId: string, imgId: string): string {
  return `${BASE_URL}/share/${shareId}/images/${imgId}`
}
