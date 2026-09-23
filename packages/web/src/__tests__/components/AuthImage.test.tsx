import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { AuthImage } from '@/components/AuthImage'
import { setAccessToken, clearTokens } from '@/lib/tokens'

function makeBlobResponse(contentType = 'image/png'): Response {
  const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: contentType })
  return new Response(blob, { status: 200, headers: { 'Content-Type': contentType } })
}

function renderAuthImage(src: string, props: Record<string, unknown> = {}) {
  return render(<AuthImage src={src} alt="test-alt" {...props} />)
}

describe('AuthImage', () => {
  beforeEach(() => {
    clearTokens()
    vi.restoreAllMocks()
  })

  describe('非 API 路径', () => {
    it('直接透传 src，不发 fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      renderAuthImage('https://example.com/photo.jpg')
      const img = screen.getByAltText('test-alt')
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('blob: 开头的 src 也直接透传', async () => {
      renderAuthImage('blob:http://localhost/test')
      const img = screen.getByAltText('test-alt')
      expect(img).toHaveAttribute('src', 'blob:http://localhost/test')
    })
  })

  describe('API 路径 + 有 token', () => {
    it('fetch 成功返回图片时转为 blob URL', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeBlobResponse('image/png'))
      setAccessToken('my-token')

      renderAuthImage('/api/boards/b-1/images/img-1')

      await waitFor(() => {
        const img = screen.getByAltText('test-alt')
        expect(img).toHaveAttribute('src', expect.stringMatching(/^blob:/))
      })

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/boards/b-1/images/img-1',
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-token' },
        }),
      )
    })

    it('响应不是 2xx 时 fallback 到原始 src', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }))
      setAccessToken('token')

      renderAuthImage('/api/boards/b-1/images/img-1')

      await waitFor(() => {
        const img = screen.getByAltText('test-alt')
        expect(img).toHaveAttribute('src', '/api/boards/b-1/images/img-1')
      })
    })

    it('fetch 抛异常时 fallback 到原始 src', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
      setAccessToken('token')

      renderAuthImage('/api/boards/b-1/images/img-1')

      await waitFor(() => {
        const img = screen.getByAltText('test-alt')
        expect(img).toHaveAttribute('src', '/api/boards/b-1/images/img-1')
      })
    })
  })

  describe('API 路径 + 无 token', () => {
    it('直接透传 src 不发 fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      renderAuthImage('/api/boards/b-1/images/img-1')
      const img = screen.getByAltText('test-alt')
      expect(img).toHaveAttribute('src', '/api/boards/b-1/images/img-1')
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('加载状态 UI', () => {
    it('初始渲染时显示 loading spinner', () => {
      renderAuthImage('https://example.com/photo.jpg')
      // loading 是一个带 animate-spin class 的 div
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('图片加载后 spinner 消失', async () => {
      renderAuthImage('https://example.com/photo.jpg')
      const img = screen.getByAltText('test-alt')

      await act(async () => {
        img.dispatchEvent(new Event('load'))
      })

      expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
    })

    it('onLoad 回调被触发', async () => {
      const onLoad = vi.fn()
      renderAuthImage('https://example.com/photo.jpg', { onLoad })
      const img = screen.getByAltText('test-alt')
      await act(async () => {
        img.dispatchEvent(new Event('load'))
      })
      expect(onLoad).toHaveBeenCalled()
    })

    it('加载错误时显示"加载失败"文案', async () => {
      renderAuthImage('https://example.com/photo.jpg')
      const img = screen.getByAltText('test-alt')
      await act(async () => {
        img.dispatchEvent(new Event('error'))
      })
      expect(screen.getByText(/加载失败/i)).toBeInTheDocument()
    })

    it('onError 回调被触发', async () => {
      const onError = vi.fn()
      renderAuthImage('https://example.com/photo.jpg', { onError })
      const img = screen.getByAltText('test-alt')
      await act(async () => {
        img.dispatchEvent(new Event('error'))
      })
      expect(onError).toHaveBeenCalled()
    })
  })

  describe('props 透传', () => {
    it('draggable 默认 false', () => {
      renderAuthImage('https://example.com/photo.jpg')
      const img = screen.getByAltText('test-alt')
      expect(img).toHaveAttribute('draggable', 'false')
    })

    it('draggable 可以设为 true', () => {
      renderAuthImage('https://example.com/photo.jpg', { draggable: true })
      const img = screen.getByAltText('test-alt')
      expect(img).toHaveAttribute('draggable', 'true')
    })

    it('className 被合并到 img', () => {
      renderAuthImage('https://example.com/photo.jpg', { className: 'custom-cls' })
      const img = screen.getByAltText('test-alt')
      expect(img.className).toContain('custom-cls')
    })
  })

  describe('src 变化', () => {
    it('src 改变时重新 fetch', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeBlobResponse('image/png'))
      setAccessToken('token')
      const { rerender } = render(<AuthImage src="/api/a" alt="a" />)
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1))
      rerender(<AuthImage src="/api/b" alt="b" />)
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))
    })
  })
})
