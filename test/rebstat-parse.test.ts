import { describe, expect, it } from 'vitest'
import { clampToRange, extractRebstatRows } from '@/lib/rebstat/parse'

describe('extractRebstatRows', () => {
  it('정상 응답(SttsApiTblData 배열)에서 row와 list_total_count를 뽑는다', () => {
    const body = {
      SttsApiTblData: [
        { head: [{ list_total_count: 1 }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상' } }] },
        { row: [{ WRTTIME_IDTFR_ID: '202601', DTA_VAL: 100 }] },
      ],
    }
    expect(extractRebstatRows(body)).toEqual({ rows: [{ WRTTIME_IDTFR_ID: '202601', DTA_VAL: 100 }], listTotalCount: 1 })
  })

  it('래퍼 없이 단독으로 오는 에러(ERROR-290)를 던진다', () => {
    const body = { RESULT: { CODE: 'ERROR-290', MESSAGE: '인증키가 유효하지 않습니다' } }
    expect(() => extractRebstatRows(body)).toThrow('REBSTAT_KEY_INVALID')
  })

  it('래퍼가 있어도 head의 RESULT.CODE가 에러면 빈 배열로 조용히 넘기지 않고 던진다', () => {
    // 문서는 "에러는 래퍼 없이 온다"고 하지만, 래퍼가 있는데 에러 코드가 담긴 경우를
    // 못 잡으면 빈 rows가 isSampleResponse에 SAMPLE_RESPONSE로 오보된다(NIT).
    const body = {
      SttsApiTblData: [{ head: [{ RESULT: { CODE: 'ERROR-290', MESSAGE: '인증키가 유효하지 않습니다' } }] }, { row: [] }],
    }
    expect(() => extractRebstatRows(body)).toThrow('REBSTAT_KEY_INVALID')
  })

  it('row가 없으면 빈 배열이고 list_total_count가 없으면 null이다', () => {
    const body = { SttsApiTblData: [{ head: [{ RESULT: { CODE: 'INFO-000' } }] }, { row: [] }] }
    expect(extractRebstatRows(body)).toEqual({ rows: [], listTotalCount: null })
  })

  it('래퍼가 아예 없으면(에러 코드도 없는 빈 객체) list_total_count는 null이다', () => {
    expect(extractRebstatRows({})).toEqual({ rows: [], listTotalCount: null })
  })
})

describe('clampToRange', () => {
  it('요청 기간 밖의 행을 잘라낸다', () => {
    const rows = [
      { WRTTIME_IDTFR_ID: '202501', DTA_VAL: 90 },
      { WRTTIME_IDTFR_ID: '202512', DTA_VAL: 95 },
      { WRTTIME_IDTFR_ID: '202601', DTA_VAL: 100 },
    ]
    expect(clampToRange(rows, '202512', '202601').map((r) => r.WRTTIME_IDTFR_ID)).toEqual(['202512', '202601'])
  })

  it('상류가 기간 필터를 무시해도(§4.5⑤) 여기서 항상 요청 기간으로 좁혀진다', () => {
    // months=1 요청인데 상류가 40개월치를 다 줬다고 가정 — BLOCKER 회귀 테스트. 창 안(202609)에
    // 정확히 1건, 창 밖에 39건을 섞어서 "항상 빈 배열이라도 통과하는" 무력한 단정을 피한다.
    const rows = [
      { WRTTIME_IDTFR_ID: '202609', DTA_VAL: 999 },
      ...Array.from({ length: 39 }, (_, i) => ({
        WRTTIME_IDTFR_ID: `2023${String((i % 12) + 1).padStart(2, '0')}`,
        DTA_VAL: i,
      })),
    ]
    const result = clampToRange(rows, '202609', '202609')
    expect(result.map((r) => r.WRTTIME_IDTFR_ID)).toEqual(['202609'])
  })
})
