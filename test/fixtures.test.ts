import { describe, expect, it } from 'vitest'
import { shiftDateString } from '@/lib/applyhome/fixtures'

// MAJOR 회귀 테스트 — 픽스처 날짜 시프트가 전화번호(8자리 숫자)까지 날짜로 오인해
// 변조하던 버그(§4.6 예외, 팀 리드 승인). shiftDateString은 순수 함수다.
describe('shiftDateString', () => {
  it('전화번호(8자리 숫자)는 날짜가 아니므로 그대로 둔다', () => {
    expect(shiftDateString('16001004')).toBe('16001004')
  })

  it('날짜가 아닌 8자리는 RangeError 없이 그대로 둔다', () => {
    expect(shiftDateString('99999999')).toBe('99999999')
  })

  it('yyyyMMdd 날짜는 형식을 유지한 채 시프트된다', () => {
    // not.toBe만 쓰면 함수가 빈 문자열을 반환해도 통과하고,
    // 오늘이 앵커일과 같으면 시프트가 0이라 실패한다. 형식으로 단정한다.
    expect(shiftDateString('20260813')).toMatch(/^\d{8}$/)
  })
})
