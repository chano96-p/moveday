import { addDays, format, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { shiftDateString, shiftDays } from '@/lib/applyhome/fixtures'

// MAJOR 회귀 테스트 — 픽스처 날짜 시프트가 전화번호(8자리 숫자)까지 날짜로 오인해
// 변조하던 버그(§4.6 예외, 팀 리드 승인). shiftDateString은 순수 함수다.
describe('shiftDateString', () => {
  it('전화번호(8자리 숫자)는 날짜가 아니므로 그대로 둔다', () => {
    expect(shiftDateString('16001004')).toBe('16001004')
  })

  it('날짜가 아닌 8자리는 RangeError 없이 그대로 둔다', () => {
    expect(shiftDateString('99999999')).toBe('99999999')
  })

  it('yyyyMMdd 날짜는 오늘 기준으로 정확히 시프트된다', () => {
    // toMatch(/^\d{8}$/)만 쓰면 시프트가 0(오늘이 앵커일)이거나 안 걸려도 형식이 같으면 통과한다.
    // shiftDays()로 기대값을 직접 계산해 toBe로 비교해야 시프트 누락을 잡는다.
    const expected = format(addDays(parseISO('2026-08-13'), shiftDays()), 'yyyyMMdd')
    expect(shiftDateString('20260813')).toBe(expected)
  })
})
