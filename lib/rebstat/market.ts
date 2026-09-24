import { CACHE_TTL, REBSTAT_CYCLE_MONTHLY, REBSTAT_ITM_INDEX, REBSTAT_TABLES } from '@/lib/config'
import { fetchRebstatRows } from '@/lib/rebstat/client'
import { clsIdFor, monthRangeFor, toMarketSeries } from '@/lib/rebstat/adapter'
import type { MarketSeries, Region } from '@/lib/types'

/**
 * 분석 입력에 붙일 지역 매매가격지수. 시세는 **보조 맥락**이라 못 구해도 분석 자체는 성립한다
 * (프롬프트가 "시세 데이터가 없으면 분양가 범위만 서술"로 지시한다) — R-ONE 키 없음·지역
 * 미매핑·상류 오류를 전부 `null`로 접어 분석 전체를 실패시키지 않는다. §5의 "market 실패 =
 * 섹션만 사라진다"와 같은 규칙이다.
 */
export async function fetchSalePriceSeriesOrNull(
  region: Region | '전국',
  months: number,
): Promise<MarketSeries | null> {
  if (!process.env.REB_STAT_API_KEY) return null

  const table = REBSTAT_TABLES.apartmentSalePriceIndex
  const clsId = clsIdFor(region, table)
  if (clsId === null) return null

  const { startWrttime, endWrttime } = monthRangeFor(months)

  try {
    const rows = await fetchRebstatRows({
      statblId: table,
      clsId,
      itmId: REBSTAT_ITM_INDEX,
      dtacycleCd: REBSTAT_CYCLE_MONTHLY,
      startWrttime,
      endWrttime,
      months,
      revalidate: CACHE_TTL.marketStats,
    })
    return toMarketSeries('sale', '아파트 매매가격지수', rows)
  } catch {
    return null
  }
}
