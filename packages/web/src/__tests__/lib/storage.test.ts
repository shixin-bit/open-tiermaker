import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateId,
  loadAllBoards,
  saveAllBoards,
  loadBoard,
  saveBoard,
  deleteBoard,
  clearAllBoards,
  migrateLegacyIfNeeded,
  loadLegacyState,
  estimateLocalStorageBytes,
  mapCloudImagesToState,
} from '@/lib/storage'
import type { LocalBoard } from '@/lib/storage'
import { DEFAULT_STATE } from '@open-tiermaker/shared'

const BOARDS_KEY = 'otm:boards'
const LEGACY_KEY = 'open-tiermaker:state'

function makeLocalBoard(overrides: Partial<LocalBoard> = {}): LocalBoard {
  return {
    id: 'board-1',
    title: '测试排行榜',
    updatedAt: Date.now(),
    state: { ...DEFAULT_STATE },
    ...overrides,
  }
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('generateId', () => {
    it('返回包含时间戳和随机后缀的字符串', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
      expect(id).toMatch(/^\d+-[a-z0-9]{7}$/)
    })

    it('连续调用返回不同值', () => {
      const a = generateId()
      const b = generateId()
      expect(a).not.toBe(b)
    })
  })

  describe('loadAllBoards / saveAllBoards', () => {
    it('空 localStorage 返回空数组', () => {
      expect(loadAllBoards()).toEqual([])
    })

    it('保存后能读取回来', () => {
      const board = makeLocalBoard()
      saveAllBoards([board])
      const loaded = loadAllBoards()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('board-1')
      expect(loaded[0].title).toBe('测试排行榜')
    })

    it('localStorage 中非法 JSON 返回空数组', () => {
      localStorage.setItem(BOARDS_KEY, 'not-json')
      expect(loadAllBoards()).toEqual([])
    })

    it('saveAllBoards 遇到异常不抛错', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded')
      })
      expect(() => saveAllBoards([makeLocalBoard()])).not.toThrow()
    })
  })

  describe('saveBoard', () => {
    it('新 board 加入列表', () => {
      const board = makeLocalBoard()
      saveBoard(board)
      expect(loadAllBoards()).toHaveLength(1)
    })

    it('已存在 board 被更新', () => {
      const first = makeLocalBoard({ title: '旧标题' })
      saveBoard(first)
      const updated = { ...first, title: '新标题' }
      saveBoard(updated)
      const boards = loadAllBoards()
      expect(boards).toHaveLength(1)
      expect(boards[0].title).toBe('新标题')
    })

    it('更新时 updatedAt 被刷新', () => {
      const board = makeLocalBoard({ updatedAt: 1000 })
      saveBoard(board)
      const stored = loadAllBoards()[0]
      expect(stored.updatedAt).toBeGreaterThanOrEqual(board.updatedAt)
    })
  })

  describe('loadBoard', () => {
    it('存在时返回 board', () => {
      const board = makeLocalBoard({ id: 'find-me' })
      saveBoard(board)
      expect(loadBoard('find-me')?.id).toBe('find-me')
    })

    it('不存在时返回 null', () => {
      expect(loadBoard('nonexistent')).toBeNull()
    })
  })

  describe('deleteBoard', () => {
    it('删除后列表不包含该 board', () => {
      saveBoard(makeLocalBoard({ id: 'a' }))
      saveBoard(makeLocalBoard({ id: 'b' }))
      deleteBoard('a')
      expect(loadAllBoards().map((b) => b.id)).toEqual(['b'])
    })

    it('删除不存在的 id 不报错', () => {
      expect(() => deleteBoard('ghost')).not.toThrow()
    })
  })

  describe('clearAllBoards', () => {
    it('清空后 loadAllBoards 返回空', () => {
      saveBoard(makeLocalBoard())
      clearAllBoards()
      expect(loadAllBoards()).toEqual([])
      expect(localStorage.getItem(BOARDS_KEY)).toBeNull()
    })
  })

  describe('loadLegacyState', () => {
    it('无 legacy key 返回 DEFAULT_STATE', () => {
      expect(loadLegacyState()).toEqual(DEFAULT_STATE)
    })

    it('有 legacy key 能解析', () => {
      const state = {
        ...DEFAULT_STATE,
        tiers: [{ id: 't1', label: 'X', color: '#fff', imageIds: [] }],
      }
      localStorage.setItem(LEGACY_KEY, JSON.stringify(state))
      expect(loadLegacyState().tiers).toHaveLength(1)
    })

    it('legacy key 是非法 JSON 时返回 DEFAULT_STATE', () => {
      localStorage.setItem(LEGACY_KEY, 'bad')
      expect(loadLegacyState()).toEqual(DEFAULT_STATE)
    })
  })

  describe('migrateLegacyIfNeeded', () => {
    it('已有新数据时不动', () => {
      saveBoard(makeLocalBoard())
      localStorage.setItem(LEGACY_KEY, JSON.stringify({ some: 'data' }))
      const result = migrateLegacyIfNeeded()
      expect(result).toHaveLength(1)
      expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
    })

    it('legacy key 不存在时返回空数组', () => {
      expect(migrateLegacyIfNeeded()).toEqual([])
    })

    it('legacy 只有默认空状态时不迁移', () => {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(DEFAULT_STATE))
      expect(migrateLegacyIfNeeded()).toEqual([])
    })

    it('legacy 有实际内容时迁移并删除旧 key', () => {
      const richState = {
        tiers: [{ id: 't1', label: 'S', color: '#f00', imageIds: ['img-1'] }],
        pool: [],
        images: {
          'img-1': { id: 'img-1', src: 'data:xxx', source: 'local' as const, createdAt: 1 },
        },
      }
      localStorage.setItem(LEGACY_KEY, JSON.stringify(richState))
      const result = migrateLegacyIfNeeded()
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('未命名排行榜')
      expect(result[0].state.tiers).toHaveLength(1)
      expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
      const saved = loadAllBoards()
      expect(saved).toHaveLength(1)
    })
  })

  describe('estimateLocalStorageBytes', () => {
    it('空 localStorage 返回一个可计算的字节数（0 或接近 0）', () => {
      const bytes = estimateLocalStorageBytes()
      expect(typeof bytes).toBe('number')
      expect(bytes).toBeGreaterThanOrEqual(0)
    })

    it('有数据时返回 > 0', () => {
      saveBoard(makeLocalBoard())
      expect(estimateLocalStorageBytes()).toBeGreaterThan(0)
    })
  })

  describe('mapCloudImagesToState', () => {
    it('正确映射 tiers 和 images', () => {
      const tiers = [
        { id: 't1', label: 'S', color: '#f00', imageIds: ['img-1'] },
        { id: 't2', label: 'A', color: '#0f0', imageIds: [] },
      ]
      const images = {
        'img-1': {
          id: 'img-1',
          src: '/api/boards/b-1/images/img-1',
          source: 'local' as const,
          createdAt: 1,
        },
      }
      const items = [{ id: 'item-1', tierKey: 't1', position: 0, title: 'img-1' }]
      const state = mapCloudImagesToState(tiers, images, items, 'b-1')
      expect(state.tiers).toHaveLength(2)
      expect(state.pool).toEqual([])
      expect(state.images['img-1'].src).toBe('/api/boards/b-1/images/img-1')
      expect(state.images['img-1'].source).toBe('local')
    })

    it('从 items 恢复图片池（tierKey === __pool__）', () => {
      const images = {
        'pool-img-1': {
          id: 'pool-img-1',
          src: '/api/boards/b-1/images/item-pool-1',
          source: 'local' as const,
          createdAt: 1,
        },
      }
      const items = [
        { id: 'item-pool-1', tierKey: '__pool__', position: 0, title: 'pool-img-1' },
        { id: 'item-pool-2', tierKey: '__pool__', position: 1, title: 'pool-img-2' },
        { id: 'item-tier-1', tierKey: 'S', position: 0, title: 'tier-img-1' },
      ]
      const state = mapCloudImagesToState([], images, items, 'b-1')
      expect(state.pool).toEqual(['pool-img-1', 'pool-img-2'])
    })

    it('空输入返回空 state', () => {
      const state = mapCloudImagesToState([], {}, [], 'b-1')
      expect(state.tiers).toEqual([])
      expect(state.pool).toEqual([])
      expect(state.images).toEqual({})
    })
  })
})
