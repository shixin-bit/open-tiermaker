import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('拼接多个真值字符串', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('过滤掉 undefined / null / false', () => {
    expect(cn('a', undefined, 'b', null, false, 'c')).toBe('a b c')
  })

  it('全是假值时返回空字符串', () => {
    expect(cn(undefined, null, false)).toBe('')
  })

  it('空输入返回空字符串', () => {
    expect(cn()).toBe('')
  })

  it('处理单个字符串', () => {
    expect(cn('single')).toBe('single')
  })
})
