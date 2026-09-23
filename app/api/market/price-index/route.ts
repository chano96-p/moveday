import { z } from 'zod'
import { CACHE_TTL, REBSTAT_CYCLE_MONTHLY, REBSTAT_ITM_INDEX, REBSTAT_TABLES, REGIONS } from '@/lib/config'
import { assertRebstatKey, fetchRebstatRows } from '@/lib/rebstat/client'
import { clsIdFor, monthRangeFor, toMarketSeries } from '@/lib/rebstat/adapter'
import { RebstatRegionUnmappedError, RebstatTableUnknownError, toErrorResponse } from '@/lib/errors'

const REGION_OR_NATION = ['전국', ...REGIONS] as const

const QuerySchema = z.object({
  region: z.enum(REGION_OR_NATION),
  months: z.coerce.number().int(),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    region: url.searchParams.get('region') ?? '전국',
    months: url.searchParams.get('months') ?? '36',
  })
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', issues: parsed.error.issues }, { status: 400 })
  }
  const { region } = parsed.data
  const months = Math.min(120, Math.max(1, parsed.data.months)) // §5 — 1~120으로 clamp

  try {
    // 가장 조치 가능한 원인부터 낸다: 키 없음 → 통계표 코드 미확정 → 지역 미매핑(팀 리드 확정).
    assertRebstatKey()

    const saleTable = REBSTAT_TABLES.apartmentSalePriceIndex
    const jeonseTable = REBSTAT_TABLES.apartmentJeonsePriceIndex
    if (saleTable === null || jeonseTable === null) throw new RebstatTableUnknownError()

    const clsId = clsIdFor(region)
    if (clsId === null) throw new RebstatRegionUnmappedError()

    const { startWrttime, endWrttime } = monthRangeFor(months)
    const fetchOptions = {
      clsId,
      itmId: REBSTAT_ITM_INDEX,
      dtacycleCd: REBSTAT_CYCLE_MONTHLY,
      startWrttime,
      endWrttime,
      months,
      revalidate: CACHE_TTL.marketStats,
    }

    const [saleRows, jeonseRows] = await Promise.all([
      fetchRebstatRows({ ...fetchOptions, statblId: saleTable }),
      fetchRebstatRows({ ...fetchOptions, statblId: jeonseTable }),
    ])

    return Response.json({
      region,
      baseNote: '기준시점 = 100. 절대 가격이 아니라 지수다.',
      series: [toMarketSeries('sale', '아파트 매매가격지수', saleRows), toMarketSeries('jeonse', '아파트 전세가격지수', jeonseRows)],
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
