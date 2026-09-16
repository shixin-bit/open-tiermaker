import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TierRow } from '@/components/TierRow'

const mockTier = {
  id: 'S',
  label: 'S',
  color: '#ef4444',
  imageIds: [],
}

function renderTierRow(overrides = {}) {
  return render(
    <TierRow
      tier={{ ...mockTier, ...overrides }}
      imageSrcs={{}}
      onRemoveImage={() => {}}
      onLabelChange={() => {}}
      onColorChange={() => {}}
      isOver={false}
    />,
  )
}

describe('TierRow', () => {
  it('should display tier label with correct text', () => {
    renderTierRow()
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  it('should display custom label', () => {
    renderTierRow({ label: '传说' })
    expect(screen.getByText('传说')).toBeInTheDocument()
  })

  it('should apply tier color to label background', () => {
    const { container } = renderTierRow({ color: '#ef4444' })
    const labelDiv = container.querySelector('[style*="background-color"]')
    expect(labelDiv).toBeTruthy()
  })

  it('should apply tier color as row background with transparency', () => {
    const { container } = renderTierRow({ color: '#22c55e' })
    const rowDiv = container.firstChild as HTMLElement
    const bg = rowDiv.style.backgroundColor
    expect(bg).toContain('34')
    expect(bg).toContain('197')
    expect(bg).toContain('94')
  })

  it('should show generic empty state hint', () => {
    renderTierRow()
    expect(screen.getByText('拖拽图片到这里')).toBeInTheDocument()
  })

  it('should use dark text on light background', () => {
    const { container } = renderTierRow({ color: '#ffffff' })
    const labelDiv = container.querySelector('.font-bold') as HTMLElement
    expect(labelDiv.style.color).toBe('rgb(26, 26, 26)')
  })

  it('should use white text on dark background', () => {
    const { container } = renderTierRow({ color: '#000000' })
    const labelDiv = container.querySelector('.font-bold') as HTMLElement
    expect(labelDiv.style.color).toBe('rgb(255, 255, 255)')
  })

  it('should render images when tier has them', () => {
    const { container } = render(
      <TierRow
        tier={{ ...mockTier, imageIds: ['img1', 'img2'] }}
        imageSrcs={{ img1: 'a.png', img2: 'b.png' }}
        onRemoveImage={() => {}}
        onLabelChange={() => {}}
        onColorChange={() => {}}
        isOver={false}
      />,
    )

    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
  })
})
