import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageCard } from '@/components/ImageCard'

// 模拟 useSortable,避免测试中需要 DndContext + SortableContext 包装
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

// 模拟 AuthImage 为简单占位,避免触发真实 fetch
vi.mock('@/components/AuthImage', () => ({
  AuthImage: ({ src }: { src: string }) => <img data-testid="auth-image" src={src} alt="" />,
}))

describe('ImageCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function renderCard(
    overrides: {
      selected?: boolean
      onSelect?: (id: string, shiftKey: boolean) => void
      onRemove?: (id: string) => void
      src?: string
      id?: string
    } = {},
  ) {
    const onRemove = overrides.onRemove ?? vi.fn()
    const onSelect = overrides.onSelect ?? vi.fn()
    const result = render(
      <ImageCard
        id={overrides.id ?? 'img-1'}
        src={overrides.src ?? 'https://example.com/photo.jpg'}
        onRemove={onRemove}
        selected={overrides.selected}
        onSelect={onSelect}
      />,
    )
    return { ...result, onRemove, onSelect }
  }

  describe('选中态渲染', () => {
    it('selected=true 时根 div 带 ring 描边类', () => {
      renderCard({ selected: true, id: 'img-1' })
      const card = screen.getByRole('button', { name: '取消选中图片' })
      expect(card.className).toContain('ring-2')
      expect(card.className).toContain('ring-primary')
      expect(card.className).toContain('ring-offset-2')
    })

    it('selected=false(默认)时不带 ring 描边类', () => {
      renderCard({ selected: false, id: 'img-1' })
      const card = screen.getByRole('button', { name: '选中图片' })
      // 不应包含 ring-offset-2(选中态独有)
      expect(card.className).not.toContain('ring-offset-2')
    })

    it('aria-pressed 反映 selected 状态', () => {
      const { rerender } = renderCard({ selected: false })
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
      rerender(
        <ImageCard
          id="img-1"
          src="https://example.com/photo.jpg"
          onRemove={vi.fn()}
          selected={true}
          onSelect={vi.fn()}
        />,
      )
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('点击选中', () => {
    it('单击触发 onSelect(id, false)', () => {
      const { onSelect } = renderCard()
      const card = screen.getByRole('button')
      fireEvent.click(card)
      expect(onSelect).toHaveBeenCalledWith('img-1', false)
    })

    it('Shift+点击触发 onSelect(id, true)', () => {
      const { onSelect } = renderCard()
      const card = screen.getByRole('button')
      fireEvent.click(card, { shiftKey: true })
      expect(onSelect).toHaveBeenCalledWith('img-1', true)
    })

    it('未传 onSelect 时点击不报错', () => {
      render(<ImageCard id="img-1" src="x" onRemove={vi.fn()} />)
      const card = screen.getByRole('button')
      expect(() => fireEvent.click(card)).not.toThrow()
    })
  })

  describe('删除按钮', () => {
    function hoverCard() {
      const utils = renderCard()
      const card = screen.getByRole('button')
      fireEvent.mouseEnter(card)
      return utils
    }

    it('hover 后显示删除按钮', () => {
      hoverCard()
      expect(screen.getByRole('button', { name: '删除图片' })).toBeInTheDocument()
    })

    it('点击删除按钮调用 onRemove(id) 并阻止冒泡到 onSelect', () => {
      const { onRemove, onSelect } = hoverCard()
      const deleteBtn = screen.getByRole('button', { name: '删除图片' })
      fireEvent.click(deleteBtn)
      expect(onRemove).toHaveBeenCalledWith('img-1')
      expect(onSelect).not.toHaveBeenCalled()
    })
  })

  it('hover 后再移出,删除按钮消失', () => {
    renderCard()
    const card = screen.getByRole('button')
    fireEvent.mouseEnter(card)
    expect(screen.queryByRole('button', { name: '删除图片' })).toBeInTheDocument()
    fireEvent.mouseLeave(card)
    expect(screen.queryByRole('button', { name: '删除图片' })).not.toBeInTheDocument()
  })
})
