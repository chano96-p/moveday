import { describe, expect, it } from 'vitest'
import { normalizeRegion } from '@/lib/region'
import { REGIONS } from '@/lib/config'

describe('normalizeRegion', () => {
  it('17개 화이트리스트 지역명을 모두 통과시킨다', () => {
    for (const region of REGIONS) {
      expect(normalizeRegion(region)).toBe(region)
    }
    expect(REGIONS.length).toBe(17)
  })

  it('화이트리스트에 없는 지역명은 null이다', () => {
    expect(normalizeRegion('서울특별시')).toBeNull()
    expect(normalizeRegion('평양')).toBeNull()
  })

  it('문자열이 아니거나 비어 있으면 null이다', () => {
    expect(normalizeRegion(null)).toBeNull()
    expect(normalizeRegion(undefined)).toBeNull()
    expect(normalizeRegion('')).toBeNull()
  })
})
