import { describe, expect, it } from 'vitest'
import { computeDday } from '@/lib/dday'

describe('computeDday', () => {
  it('오늘 마감이면 D-0이다', () => {
    const now = new Date('2026-09-22T09:00:00+09:00')
    const { dday } = computeDday('2026-09-15', '2026-09-22', now)
    expect(dday).toBe(0)
  })

  it('마감 하루 전이면 D-1이다', () => {
    const now = new Date('2026-09-22T09:00:00+09:00')
    const { dday } = computeDday('2026-09-15', '2026-09-23', now)
    expect(dday).toBe(1)
  })

  it('마감 하루 뒤(경계)이면 D-day는 음수, status는 closed다', () => {
    const now = new Date('2026-09-22T09:00:00+09:00')
    const { dday, status } = computeDday('2026-09-10', '2026-09-21', now)
    expect(dday).toBe(-1)
    expect(status).toBe('closed')
  })

  it('접수 시작 전이면 upcoming이다', () => {
    const now = new Date('2026-09-22T09:00:00+09:00')
    const { status } = computeDday('2026-09-23', '2026-09-25', now)
    expect(status).toBe('upcoming')
  })

  it('접수 기간 중이면 open이다', () => {
    const now = new Date('2026-09-22T09:00:00+09:00')
    const { status } = computeDday('2026-09-20', '2026-09-25', now)
    expect(status).toBe('open')
  })

  it('접수 종료일 당일은 아직 open이다', () => {
    const now = new Date('2026-09-22T23:00:00+09:00')
    const { status } = computeDday('2026-09-20', '2026-09-22', now)
    expect(status).toBe('open')
  })

  it('KST 00시~09시 사이에도 마감 판정이 하루 밀리지 않는다 (TZ=UTC 환경 재현)', () => {
    // KST 2026-09-22T03:00 == UTC 2026-09-21T18:00. 접수종료 9/21이면 KST 기준 이미 마감이다.
    const now = new Date('2026-09-21T18:00:00Z')
    const { dday, status } = computeDday('2026-09-15', '2026-09-21', now)
    expect(dday).toBe(-1)
    expect(status).toBe('closed')
  })

  describe('status 4경우 (§4.1)', () => {
    const now = new Date('2026-09-22T09:00:00+09:00')

    it('시작일이 미래면 종료일 유무와 무관하게 upcoming이다', () => {
      expect(computeDday('2026-09-23', '2026-09-25', now).status).toBe('upcoming')
      expect(computeDday('2026-09-23', null, now).status).toBe('upcoming')
    })

    it('종료일이 없으면(시작일만 있거나 둘 다 없거나) unknown이다', () => {
      expect(computeDday('2026-09-01', null, now).status).toBe('unknown')
      expect(computeDday(null, null, now).status).toBe('unknown')
    })

    it('종료일이 과거면 closed다', () => {
      expect(computeDday('2026-09-01', '2026-09-10', now).status).toBe('closed')
    })

    it('종료일이 오늘~미래면 open이다', () => {
      expect(computeDday('2026-09-01', '2026-09-25', now).status).toBe('open')
    })
  })
})
