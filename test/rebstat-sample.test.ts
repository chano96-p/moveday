import { describe, expect, it } from 'vitest'
import { isSampleResponse } from '@/lib/rebstat/parse'

// §4.6 명시 테스트 — KEY를 생략하면 에러가 아니라 실제 데이터 5건이 온다(§4.5①).
describe('isSampleResponse', () => {
  it('5건 이하인데 그보다 긴 기간을 요청했으면 샘플 응답으로 판단한다', () => {
    expect(isSampleResponse(5, 36)).toBe(true)
  })

  it('요청한 개월수만큼 다 왔으면(36건) 샘플이 아니다', () => {
    expect(isSampleResponse(36, 36)).toBe(false)
  })

  it('요청한 개월수가 받은 건수보다 많지 않으면 샘플이 아니다(경계값)', () => {
    expect(isSampleResponse(5, 5)).toBe(false)
  })
})
