import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  request,
  api,
  ApiError,
  buildImageUrl,
  buildShareImageUrl,
  emitAuthRequired,
  onAuthRequired,
} from '@/lib/api/client'
import { setAccessToken, clearTokens, getAccessToken } from '@/lib/tokens'

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const hdrs = new Headers(headers)
  if (status === 204) {
    return new Response(null, { status, headers: hdrs })
  }
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  return new Response(text, { status, headers: hdrs })
}

describe('api/client', () => {
  beforeEach(() => {
    clearTokens()
    vi.restoreAllMocks()
  })

  describe('ApiError', () => {
    it('从 data.message 提取消息', () => {
      const err = new ApiError(400, { message: '邮箱格式错误' })
      expect(err.status).toBe(400)
      expect(err.message).toBe('邮箱格式错误')
      expect(err.data).toEqual({ message: '邮箱格式错误' })
    })

    it('data 没有 message 字段时用 HTTP status 作消息', () => {
      const err = new ApiError(500, { foo: 'bar' })
      expect(err.message).toBe('HTTP 500')
    })

    it('data 为 null 时用 HTTP status 作消息', () => {
      const err = new ApiError(404, null)
      expect(err.message).toBe('HTTP 404')
    })

    it('data.message 不是字符串时 fallback 到 HTTP status', () => {
      const err = new ApiError(422, { message: 123 })
      expect(err.message).toBe('HTTP 422')
    })
  })

  describe('request - 基础行为', () => {
    it('GET 请求拼接 /api 前缀', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(200, { ok: true }))
      const data = await request<{ ok: true }>('/boards')
      expect(data).toEqual({ ok: true })
      expect(spy).toHaveBeenCalled()
      const [url, init] = spy.mock.calls[0]
      expect(url).toBe('/api/boards')
      expect((init as RequestInit).method ?? 'GET').toBe('GET')
    })

    it('完整 URL 不拼接 /api 前缀', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(200, {}))
      await request('https://other.com/boards')
      expect(spy).toHaveBeenCalledWith('https://other.com/boards', expect.anything())
    })

    it('自动注入 Content-Type: application/json', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(200, {}))
      await api.post('/boards', { title: 'hi' })
      const init = spy.mock.calls[0][1] as RequestInit
      const headers = new Headers(init.headers)
      expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('已有 Content-Type 不被覆盖', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(200, {}))
      await request('/x', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'raw',
      })
      const init = spy.mock.calls[0][1] as RequestInit
      const headers = new Headers(init.headers)
      expect(headers.get('Content-Type')).toBe('text/plain')
    })

    it('204 返回 undefined', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(204, null))
      const data = await request('/boards/123', { method: 'DELETE' })
      expect(data).toBeUndefined()
    })

    it('非 2xx 抛出 ApiError', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(400, { message: '参数错误' }))
      let thrown: unknown
      try {
        await request('/bad')
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(ApiError)
      const err = thrown as ApiError
      expect(err.status).toBe(400)
      expect(err.message).toBe('参数错误')
    })

    it('500 响应体解析失败时用 statusText 作 data', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('not-json', { status: 500, statusText: 'Server Error' }),
      )
      await expect(request('/boom')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('request - auth header 注入', () => {
    it('有 access token 时自动注入 Authorization header', async () => {
      setAccessToken('my-token')
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(200, {}))
      await request('/me')
      const init = spy.mock.calls[0][1] as RequestInit
      const headers = new Headers(init.headers)
      expect(headers.get('Authorization')).toBe('Bearer my-token')
    })

    it('auth: false 时不注入 Authorization header', async () => {
      setAccessToken('should-not-appear')
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(200, {}))
      await request('/public', { auth: false })
      const init = spy.mock.calls[0][1] as RequestInit
      const headers = new Headers(init.headers)
      expect(headers.get('Authorization')).toBeNull()
    })
  })

  describe('request - 401 refresh 逻辑', () => {
    it('401 时用 cookie 中的 refresh token 换 access token 后重试原始请求成功', async () => {
      const urls: string[] = []
      let protectedCount = 0
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          urls.push(url)
          if (url === '/api/auth/refresh') {
            // refresh 请求不带 body，带 credentials: 'include'
            expect(init?.credentials).toBe('include')
            return makeResponse(200, { accessToken: 'new-access' })
          }
          if (url === '/api/protected') {
            protectedCount++
            if (protectedCount === 1) {
              return makeResponse(401, { message: 'unauthorized' })
            }
            return makeResponse(200, { ok: true })
          }
          return makeResponse(500, { message: 'unexpected' })
        },
      )

      const data = await request<{ ok: true }>('/protected')
      expect(data).toEqual({ ok: true })
      expect(urls).toEqual(['/api/protected', '/api/auth/refresh', '/api/protected'])
    })

    it('refresh 失败时清 token 并 emit auth:required', async () => {
      setAccessToken('old-access')
      let fired = false
      const off = onAuthRequired(() => {
        fired = true
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(401, { message: 'unauthorized' }),
      )

      let thrown: unknown
      try {
        await request('/protected')
      } catch (e) {
        thrown = e
      }
      expect(fired).toBe(true)
      expect(thrown).toBeInstanceOf(ApiError)
      const err = thrown as ApiError
      expect(err.status).toBe(401)
      // access token 从内存清除
      expect(getAccessToken()).toBeNull()

      off()
    })

    it('cookie 中无 refresh token（refresh 返回 401）时直接失败', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(401, { message: 'unauthorized' }),
      )
      await expect(request('/protected')).rejects.toMatchObject({ status: 401 })
    })

    it('skipRefresh: true 时即使 401 也不尝试 refresh', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(makeResponse(401, { message: 'session expired' }))
      await expect(request('/auth/logout', { skipRefresh: true })).rejects.toMatchObject({
        status: 401,
      })
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('api.upload', () => {
    it('构造 FormData 请求', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(makeResponse(200, { id: 'img-1' }))
      const file = new File(['fake-image'], 'test.png', { type: 'image/png' })
      const result = await api.upload<{ id: string }>('/boards/b-1/images', file)
      expect(result).toEqual({ id: 'img-1' })

      const init = spy.mock.calls[0][1] as RequestInit
      expect(init.method).toBe('POST')
      expect(init.body).toBeInstanceOf(FormData)
      const fd = init.body as FormData
      expect(fd.get('file')).toBe(file)
    })
  })

  describe('URL 构造函数', () => {
    it('buildImageUrl', () => {
      expect(buildImageUrl('board-1', 'img-99')).toBe('/api/boards/board-1/images/img-99')
    })

    it('buildShareImageUrl', () => {
      expect(buildShareImageUrl('share-abc', 'img-1')).toBe('/api/share/share-abc/images/img-1')
    })
  })

  describe('emitAuthRequired / onAuthRequired', () => {
    it('派发事件并触发 handler', () => {
      let called = 0
      const off = onAuthRequired(() => called++)
      emitAuthRequired()
      expect(called).toBe(1)
      off()
      emitAuthRequired()
      expect(called).toBe(1)
    })

    it('force=true 时回调收到 force 参数', () => {
      let forceVal: boolean | null = null
      const off = onAuthRequired((force) => {
        forceVal = force
      })
      emitAuthRequired(true)
      expect(forceVal).toBe(true)
      off()
    })

    it('无参数时 force 默认为 false', () => {
      let forceVal: boolean | null = null
      const off = onAuthRequired((force) => {
        forceVal = force
      })
      emitAuthRequired()
      expect(forceVal).toBe(false)
      off()
    })

    it('注册多个 handler 都能被触发', () => {
      let a = 0
      let b = 0
      const offA = onAuthRequired(() => a++)
      const offB = onAuthRequired(() => b++)
      emitAuthRequired()
      expect(a).toBe(1)
      expect(b).toBe(1)
      offA()
      offB()
    })
  })
})
