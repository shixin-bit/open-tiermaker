import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthModal } from '@/components/AuthModal'
import { emitAuthRequired } from '@/lib/api/client'

// mock useAuth
const mockLogin = vi.fn()
interface MockAuthReturn {
  login: typeof mockLogin
  isAuthenticated: boolean
  loading: boolean
  user: { id: string; email: string; username: string | null; avatarUrl: string | null } | null
  register: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
  completeOAuth: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
}
const mockUseAuth = vi.fn((): MockAuthReturn => ({
  login: mockLogin,
  isAuthenticated: false,
  loading: false,
  user: null,
  register: vi.fn(),
  logout: vi.fn(),
  completeOAuth: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: (): MockAuthReturn => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  ApiError: class extends Error {
    status: number
    data: unknown
    constructor(status: number, data: unknown) {
      super((data as { message?: string })?.message ?? `HTTP ${status}`)
      this.status = status
      this.data = data
    }
  },
}))

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
    localStorage.clear()
    mockLogin.mockReset()
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      loading: false,
      user: null,
      register: vi.fn(),
      logout: vi.fn(),
      completeOAuth: vi.fn(),
      refresh: vi.fn(),
    } satisfies MockAuthReturn)
  })

  it('初始不渲染（open = false）', () => {
    renderModal()
    expect(screen.queryByRole('heading', { name: '登录' })).not.toBeInTheDocument()
  })

  it('收到 auth:required 事件后打开登录表单', () => {
    renderModal()
    act(() => emitAuthRequired())
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    expect(screen.getByLabelText('密码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /立即注册/i })).toBeInTheDocument()
  })

  it('点击关闭按钮关闭弹窗', () => {
    renderModal()
    act(() => emitAuthRequired())
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('heading', { name: '登录' })).not.toBeInTheDocument()
  })

  it('点击遮罩关闭弹窗', () => {
    renderModal()
    act(() => emitAuthRequired())
    const overlay = document.querySelector('.fixed.inset-0.z-50')
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay!)
    expect(screen.queryByRole('heading', { name: '登录' })).not.toBeInTheDocument()
  })

  it('点击弹窗内部不关闭（stopPropagation）', () => {
    renderModal()
    act(() => emitAuthRequired())
    const panel = document.querySelector('.bg-card.border.border-border.rounded-lg')
    expect(panel).toBeTruthy()
    fireEvent.click(panel!)
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
  })

  it('注册链接指向 /register', () => {
    renderModal()
    act(() => emitAuthRequired())
    const regLink = screen.getByRole('link', { name: /立即注册/i })
    expect(regLink.getAttribute('href')).toBe('/register')
  })

  it('提交表单时调用 login(email, password)', async () => {
    mockLogin.mockResolvedValueOnce({ id: 'u1' })
    renderModal()
    act(() => emitAuthRequired())

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '登录' }))
    })

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
  })

  it('登录成功后关闭弹窗', async () => {
    mockLogin.mockResolvedValueOnce({ id: 'u1' })
    renderModal()
    act(() => emitAuthRequired())
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '登录' }))
    })

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '登录' })).not.toBeInTheDocument()
    })
  })

  it('登录失败时显示错误消息', async () => {
    const { ApiError } = await import('@/hooks/useAuth')
    mockLogin.mockRejectedValueOnce(new ApiError(401, { message: '邮箱或密码错误' }))
    renderModal()
    act(() => emitAuthRequired())

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '登录' }))
    })

    expect(screen.getByText('邮箱或密码错误')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
  })

  it('关闭后再收到非强制 auth:required 不打开（dismissed）', () => {
    renderModal()
    act(() => emitAuthRequired())
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('heading', { name: '登录' })).not.toBeInTheDocument()
    // 非强制触发不打开
    act(() => emitAuthRequired())
    expect(screen.queryByRole('heading', { name: '登录' })).not.toBeInTheDocument()
  })

  it('关闭后收到强制 auth:required(true) 重新打开', () => {
    renderModal()
    act(() => emitAuthRequired())
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    // 强制触发始终打开
    act(() => emitAuthRequired(true))
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
  })

  it('isAuthenticated 变 true 时自动关闭', async () => {
    const { rerender } = renderModal()
    act(() => emitAuthRequired())
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()

    // 模拟外部登录成功（如 OAuth 回调）
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      isAuthenticated: true,
      loading: false,
      user: { id: 'u1', email: 'a@b.com', username: null, avatarUrl: null },
      register: vi.fn(),
      logout: vi.fn(),
      completeOAuth: vi.fn(),
      refresh: vi.fn(),
    } satisfies MockAuthReturn)

    rerender(
      <MemoryRouter>
        <AuthModal />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '登录' })).not.toBeInTheDocument()
    })
  })
})
