import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthModal } from '@/components/AuthModal'
import { emitAuthRequired } from '@/lib/api/client'

function renderModal() {
  return render(
    <MemoryRouter>
      <AuthModal />
    </MemoryRouter>,
  )
}

describe('AuthModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('初始不渲染（open = false）', () => {
    renderModal()
    expect(screen.queryByText('需要登录')).not.toBeInTheDocument()
  })

  it('收到 auth:required 事件后打开', async () => {
    renderModal()
    act(() => {
      emitAuthRequired()
    })
    expect(screen.getByText('需要登录')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /立即登录/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /免费注册/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /稍后再说/i })).toBeInTheDocument()
  })

  it('点击稍后再说关闭 Modal', async () => {
    renderModal()
    act(() => emitAuthRequired())
    expect(screen.getByText('需要登录')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /稍后再说/i }))
    expect(screen.queryByText('需要登录')).not.toBeInTheDocument()
  })

  it('点击右上角关闭按钮关闭 Modal', async () => {
    renderModal()
    act(() => emitAuthRequired())
    const closeBtn = document.querySelector('button.text-xl')
    expect(closeBtn).toBeTruthy()
    fireEvent.click(closeBtn!)
    expect(screen.queryByText('需要登录')).not.toBeInTheDocument()
  })

  it('点击遮罩关闭 Modal', async () => {
    renderModal()
    act(() => emitAuthRequired())
    const overlay = document.querySelector('.fixed.inset-0.z-50')
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay!)
    expect(screen.queryByText('需要登录')).not.toBeInTheDocument()
  })

  it('点击 Modal 内部不关闭（stopPropagation）', async () => {
    renderModal()
    act(() => emitAuthRequired())
    const panel = document.querySelector('.bg-card.border.border-border.rounded-lg')
    expect(panel).toBeTruthy()
    fireEvent.click(panel!)
    expect(screen.getByText('需要登录')).toBeInTheDocument()
  })

  it('登录链接指向 /login', async () => {
    renderModal()
    act(() => emitAuthRequired())
    const loginLink = screen.getByRole('link', { name: /立即登录/i })
    expect(loginLink.getAttribute('href')).toBe('/login')
  })

  it('注册链接指向 /register', async () => {
    renderModal()
    act(() => emitAuthRequired())
    const regLink = screen.getByRole('link', { name: /免费注册/i })
    expect(regLink.getAttribute('href')).toBe('/register')
  })
})
