import { renderHook, act, waitFor } from '@testing-library/react'
import { useTierState } from '@/hooks/useTierState'
import { DEFAULT_STATE } from '@/lib/types'

describe('useTierState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('addImage', () => {
    it('should add image to pool with unique id', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        result.current.addImage('http://example.com/img.png', 'url')
      })

      expect(result.current.state.pool).toHaveLength(1)
      const id = result.current.state.pool[0]
      expect(result.current.state.images[id]).toBeDefined()
      expect(result.current.state.images[id].src).toBe('http://example.com/img.png')
      expect(result.current.state.images[id].source).toBe('url')
    })

    it('should add multiple images with unique ids', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        result.current.addImage('a.png', 'local')
        result.current.addImage('b.png', 'local')
      })

      expect(result.current.state.pool).toHaveLength(2)
      expect(new Set(result.current.state.pool).size).toBe(2)
    })
  })

  describe('removeImage', () => {
    it('should remove image from pool and images map', () => {
      const { result } = renderHook(() => useTierState())

      let id: string
      act(() => {
        id = result.current.addImage('test.png', 'local')
      })

      act(() => {
        result.current.removeImage(id)
      })

      expect(result.current.state.pool).toHaveLength(0)
      expect(result.current.state.images[id!]).toBeUndefined()
    })

    it('should remove image from tier row', () => {
      const { result } = renderHook(() => useTierState())

      let id: string
      act(() => {
        id = result.current.addImage('test.png', 'local')
        result.current.moveImage(id, { type: 'pool' }, { type: 'tier', tierId: 'S' })
      })

      expect(result.current.state.tiers[0].imageIds).toContain(id)

      act(() => {
        result.current.removeImage(id!)
      })

      expect(result.current.state.tiers[0].imageIds).not.toContain(id)
      expect(result.current.state.images[id!]).toBeUndefined()
    })
  })

  describe('moveImage', () => {
    let id: string

    beforeEach(() => {
      const { result } = renderHook(() => useTierState())
      act(() => {
        id = result.current.addImage('test.png', 'local')
      })
    })

    it('should move image from pool to tier', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        id = result.current.addImage('test.png', 'local')
        result.current.moveImage(id, { type: 'pool' }, { type: 'tier', tierId: 'S' })
      })

      expect(result.current.state.pool).not.toContain(id)
      expect(result.current.state.tiers[0].imageIds).toContain(id)
    })

    it('should move image from tier back to pool', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        id = result.current.addImage('test.png', 'local')
        result.current.moveImage(id, { type: 'pool' }, { type: 'tier', tierId: 'A' })
        result.current.moveImage(id, { type: 'tier', tierId: 'A' }, { type: 'pool' })
      })

      expect(result.current.state.pool).toContain(id)
      expect(result.current.state.tiers[1].imageIds).not.toContain(id)
    })

    it('should move image between tiers', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        id = result.current.addImage('test.png', 'local')
        result.current.moveImage(id, { type: 'pool' }, { type: 'tier', tierId: 'S' })
        result.current.moveImage(id, { type: 'tier', tierId: 'S' }, { type: 'tier', tierId: 'B' })
      })

      expect(result.current.state.tiers[0].imageIds).not.toContain(id)
      expect(result.current.state.tiers[2].imageIds).toContain(id)
    })

    it('should insert image at correct index', () => {
      const { result } = renderHook(() => useTierState())

      let id1: string, id2: string, id3: string
      act(() => {
        id1 = result.current.addImage('a.png', 'local')
        id2 = result.current.addImage('b.png', 'local')
        id3 = result.current.addImage('c.png', 'local')
        result.current.moveImage(id1!, { type: 'pool' }, { type: 'tier', tierId: 'S' })
        result.current.moveImage(id2!, { type: 'pool' }, { type: 'tier', tierId: 'S' })
        result.current.moveImage(id3!, { type: 'pool' }, { type: 'tier', tierId: 'S' }, 1)
      })

      expect(result.current.state.tiers[0].imageIds).toEqual([id1, id3, id2])
    })
  })

  describe('updateTierLabel', () => {
    it('should update tier label', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        result.current.updateTierLabel('S', '传说')
      })

      const sTier = result.current.state.tiers.find((t) => t.id === 'S')
      expect(sTier?.label).toBe('传说')
    })

    it('should reject empty label', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        result.current.updateTierLabel('S', '')
      })

      expect(result.current.state.tiers[0].label).toBe('S')
    })

    it('should reject label longer than 20 chars', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        result.current.updateTierLabel('S', '这是一个非常非常非常非常长的标签超过二十个字符')
      })

      expect(result.current.state.tiers[0].label).toBe('S')
    })
  })

  describe('updateTierColor', () => {
    it('should update tier color', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        result.current.updateTierColor('S', '#000000')
      })

      expect(result.current.state.tiers[0].color).toBe('#000000')
    })
  })

  describe('reset', () => {
    it('should restore default state', () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        result.current.addImage('test.png', 'local')
        result.current.updateTierLabel('S', '改了')
        result.current.reset()
      })

      expect(result.current.state).toEqual(DEFAULT_STATE)
    })
  })

  describe('localStorage persistence', () => {
    it('should save state to localStorage on change', async () => {
      const { result } = renderHook(() => useTierState())

      act(() => {
        result.current.updateTierLabel('A', '优秀')
      })

      await waitFor(() => {
        const stored = localStorage.getItem('open-tiermaker:state')
        expect(stored).not.toBeNull()
        const parsed = JSON.parse(stored!)
        expect(parsed.tiers[1].label).toBe('优秀')
      })
    })

    it('should load state from localStorage on init', () => {
      const saved = {
        tiers: [
          { id: 'S', label: '保存的S', color: '#ff0000', imageIds: [] },
          { id: 'A', label: '保存的A', color: '#ff0000', imageIds: [] },
          { id: 'B', label: '保存的B', color: '#ff0000', imageIds: [] },
          { id: 'C', label: '保存的C', color: '#ff0000', imageIds: [] },
          { id: 'D', label: '保存的D', color: '#ff0000', imageIds: [] },
        ],
        pool: [],
        images: {},
      }
      localStorage.setItem('open-tiermaker:state', JSON.stringify(saved))

      const { result } = renderHook(() => useTierState())

      expect(result.current.state.tiers[0].label).toBe('保存的S')
    })
  })
})
