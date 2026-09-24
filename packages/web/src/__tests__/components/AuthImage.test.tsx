import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthImage } from '@/components/AuthImage'

function renderAuthImage(src: string, props: Record<string, unknown> = {}) {
  return render(<AuthImage src={src} alt="test-alt" {...props} />)
}

describe('AuthImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('基础渲染', () => {
    it('直接透传 src 到 img', () => {
      renderAuthImage('https://example.com/photo.jpg')
      const img = screen.getByAltText('test-alt')
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
    })

    it('data URL 也直接透传', () => {
      renderAuthImage('data:image/png;base64,abc')
      const img = screen.getByAltText('test-alt')
      expect(img).toHaveAttribute('src', 'data:image/png;base64,abc')
    })

    it('API 路径也直接透传（图片不鉴权）', () => {
      renderAuthImage('/api/boards/b-1/images/img-1')
      const img = screen.getByAltText('test-alt')
      expect(img).toHaveAttribute('src', '/api/boards/b-1/images/img-1')
    })
  })

  describe('加载状态 UI', () => {
    it('初始渲染时显示 loading spinner', () => {
      renderAuthImage('https://example.com/photo.jpg')
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
})
