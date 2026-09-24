import { describe, expect, it } from 'vitest'
import { clsIdFor, toMarketSeries } from '@/lib/rebstat/adapter'
import { REBSTAT_TABLES } from '@/lib/config'
import type { RebstatRow } from '@/lib/rebstat/parse'

const SALE = REBSTAT_TABLES.apartmentSalePriceIndex
const JEONSE = REBSTAT_TABLES.apartmentJeonsePriceIndex
const REAL_TRANSACTION = REBSTAT_TABLES.apartmentRealTransactionIndex

// §4.0/§4.5④ — 지역은 CLS_FULLNM(표시 문자열)이 아니라 CLS_ID(코드)로 매핑한다.
// Phase 8 실측 — CLS_ID는 지역만으로 정해지지 않고 통계표마다 다른 체계를 쓴다.
describe('clsIdFor', () => {
  it('전국은 세 표 모두 같은 CLS_ID(500001)다', () => {
    expect(clsIdFor('전국', SALE)).toBe(500001)
    expect(clsIdFor('전국', JEONSE)).toBe(500001)
    expect(clsIdFor('전국', REAL_TRANSACTION)).toBe(500001)
  })

  it('매매·전세는 같은 CLS_ID 체계를 쓴다', () => {
    expect(clsIdFor('서울', SALE)).toBe(clsIdFor('서울', JEONSE))
    expect(clsIdFor('제주', SALE)).toBe(clsIdFor('제주', JEONSE))
  })

  // BLOCKER 회귀 — 표를 안 가리고 지역만으로 조회하면 real-transaction이 매매·전세와
  // 같은 코드를 쓰게 돼 조용히 다른 지역 데이터를 준다. 서울로 실측 확인한 값이 다르다.
  it('실거래는 매매·전세와 CLS_ID 체계가 다르다(서울 500008 vs 500007)', () => {
    expect(clsIdFor('서울', SALE)).toBe(500008)
    expect(clsIdFor('서울', REAL_TRANSACTION)).toBe(500007)
    expect(clsIdFor('서울', SALE)).not.toBe(clsIdFor('서울', REAL_TRANSACTION))
  })

  it('부산도 표마다 CLS_ID가 다르다(매매 500011 vs 실거래 500008)', () => {
    expect(clsIdFor('부산', SALE)).toBe(500011)
    expect(clsIdFor('부산', REAL_TRANSACTION)).toBe(500008)
  })

  it('인천은 우연히 세 표 모두 같은 CLS_ID(500010)다', () => {
    expect(clsIdFor('인천', SALE)).toBe(500010)
    expect(clsIdFor('인천', REAL_TRANSACTION)).toBe(500010)
  })
})

function row(wrttime: string, value: number): RebstatRow {
  return { WRTTIME_IDTFR_ID: wrttime, DTA_VAL: value }
}

describe('toMarketSeries — mom/yoy 계산', () => {
  it('전월·전년 동월 데이터가 있으면 mom/yoy를 계산한다', () => {
    const rows = [row('202501', 100), row('202502', 102), row('202601', 105), row('202602', 106.02)]
    const series = toMarketSeries('sale', '아파트 매매가격지수', rows)

    expect(series.points.map((p) => p.month)).toEqual(['2025-01', '2025-02', '2026-01', '2026-02'])
    // mom: (106.02 - 105) / 105 * 100 = 0.97..%
    expect(series.change.mom).toBeCloseTo(0.97, 1)
    // yoy: (106.02 - 102) / 102 * 100 = 3.94..%
    expect(series.change.yoy).toBeCloseTo(3.94, 1)
  })

  it('전월 데이터가 없으면 mom은 null이다', () => {
    const rows = [row('202501', 100)]
    const series = toMarketSeries('sale', '아파트 매매가격지수', rows)
    expect(series.change.mom).toBeNull()
    expect(series.change.yoy).toBeNull()
  })

  it('행이 없으면 mom/yoy 둘 다 null이다', () => {
    const series = toMarketSeries('sale', '아파트 매매가격지수', [])
    expect(series.points).toEqual([])
    expect(series.change).toEqual({ mom: null, yoy: null })
  })

  it('입력 순서가 뒤섞여도 month 오름차순으로 정렬한다', () => {
    const rows = [row('202603', 101), row('202601', 99), row('202602', 100)]
    const series = toMarketSeries('sale', '아파트 매매가격지수', rows)
    expect(series.points.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('DTA_VAL이 숫자가 아닌 행은 걸러내고 나머지로 계산한다', () => {
    const bad = { WRTTIME_IDTFR_ID: '202601', DTA_VAL: null as unknown as number }
    const series = toMarketSeries('sale', '아파트 매매가격지수', [bad, row('202602', 100)])
    expect(series.points).toEqual([{ month: '2026-02', value: 100 }])
  })
})
