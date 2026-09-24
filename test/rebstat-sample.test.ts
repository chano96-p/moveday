import { describe, expect, it } from 'vitest'
import { isSampleResponse } from '@/lib/rebstat/parse'

// §4.6 명시 테스트 — KEY를 생략하면 에러가 아니라 실제 데이터가 온다(§4.5①), 다만 상류가
// pSize만큼 다 안 주고 잘라서 보낸다. list_total_count(상류가 보고하는 전체 건수)와 실제
// 받은 행 수를 비교해 판별한다 — 예전 기준(requestedMonths와 rowCount 비교)은 공표 지연으로
// 실제 건수 자체가 적은 정상 응답을 샘플로 오판했다(팀 리드 실측).
describe('isSampleResponse', () => {
  it('받은 행 수가 list_total_count보다 적으면 잘린 것이다 — 샘플로 판단한다', () => {
    expect(isSampleResponse(5, 6, 300)).toBe(true)
  })

  it('받은 행 수가 list_total_count와 같으면 샘플이 아니다 — 그게 전부인 것이다', () => {
    expect(isSampleResponse(36, 36, 300)).toBe(false)
  })

  it('공표 지연으로 실제 건수 자체가 적어도(5건) list_total_count와 같으면 샘플이 아니다', () => {
    // 예전 기준(requestedMonths > rowCount)이라면 요청 6개월에 5건만 와서 샘플로 오판했을
    // 자리 — 공표 지연이 원인이면 list_total_count도 정직하게 5를 보고한다.
    expect(isSampleResponse(5, 5, 300)).toBe(false)
  })

  it('list_total_count를 모르면(null) 샘플로 단정하지 않는다', () => {
    // 정상 요청에 틀린 에러를 내는 쪽이 더 나쁘다(§4.5①) — 판별 불가는 데이터를 돌려주는
    // 쪽으로 기운다.
    expect(isSampleResponse(5, null, 300)).toBe(false)
  })

  it('페이지 한도만큼 받았으면 페이지네이션이지 샘플이 아니다', () => {
    // 시계열이 pSize를 넘으면(월 1행씩 늘어 약 26개월 뒤, 또는 주간 주기 통계표를 추가하면
    // 즉시) 상류는 정상적으로 한도만큼만 준다. 이걸 "잘렸다"로 읽으면 정상 응답이 502가 된다
    // — clampToRange를 남겨둔 이유와 정면으로 모순되는 실패다(리뷰어 지적).
    expect(isSampleResponse(300, 310, 300)).toBe(false)
  })

  it('한도에 못 미치는데 총건수보다 적으면 여전히 샘플이다', () => {
    // 한도 예외가 판정 전체를 무력화하지 않는지 — 5건은 한도(300)에 한참 못 미친다.
    expect(isSampleResponse(5, 310, 300)).toBe(true)
  })
})
