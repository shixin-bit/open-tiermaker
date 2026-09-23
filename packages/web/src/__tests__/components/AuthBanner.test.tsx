import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthBanner } from '@/components/AuthBanner'

const DISMISS_KEY = 'otm:banner:auth-dismissed'
const BOARDS_KEY = 'otm:boards'

function renderBanner() {
  return render(
    <MemoryRouter>
      <AuthBanner />
    </MemoryRouter>,
  )
}

describe('AuthBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('初始状态（无本地排行榜、未关闭）显示 banner', () => {
    renderBanner()
    expect(screen.getByText(/开启云端保存/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /免费注册/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/关闭提示/i)).toBeInTheDocument()
  })

  it('有本地排行榜时不显示', () => {
    localStorage.setItem(
      BOARDS_KEY,
      JSON.stringify([
        { id: 'x', title: 't', updatedAt: 1, state: { tiers: [], pool: [], images: {} } },
      ]),
    )
    renderBanner()
    expect(screen.queryByText(/开启云端保存/i)).not.toBeInTheDocument()
  })

  it('空数组不算有本地排行榜', () => {
    localStorage.setItem(BOARDS_KEY, JSON.stringify([]))
    renderBanner()
    expect(screen.getByText(/开启云端保存/i)).toBeInTheDocument()
  })

  it('关闭后写入 localStorage 并隐藏', async () => {
    renderBanner()
    expect(screen.getByText(/开启云端保存/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/关闭提示/i))
    expect(localStorage.getItem(DISMISS_KEY)).toBe('1')
    await waitFor(() => {
      expect(screen.queryByText(/开启云端保存/i)).not.toBeInTheDocument()
    })
  })

  it('已关闭状态下不显示', () => {
    localStorage.setItem(DISMISS_KEY, '1')
    renderBanner()
    expect(screen.queryByText(/开启云端保存/i)).not.toBeInTheDocument()
  })

  it('localStorage.getItem 抛异常时不崩', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })
    expect(() => renderBanner()).not.toThrow()
  })
})
