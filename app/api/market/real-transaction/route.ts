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
  const months = Math.min(120, Math.max(1, parsed.data.months))

  try {
    assertRebstatKey()

    // 공동주택 실거래가격지수는 STATBL_ID가 아직 미확정이다(§4.5③) — 이 라우트는 지금 항상
    // 503이고, 그게 정상 동작이다. Phase 8에서 코드만 채우면 나머지는 그대로 동작한다.
    const table = REBSTAT_TABLES.apartmentRealTransactionIndex
    if (table === null) throw new RebstatTableUnknownError()

    const clsId = clsIdFor(region)
    if (clsId === null) throw new RebstatRegionUnmappedError()

    const { startWrttime, endWrttime } = monthRangeFor(months)
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

    return Response.json({
      region,
      baseNote: '기준시점 = 100. 절대 가격이 아니라 지수다.',
      series: [toMarketSeries('realTransaction', '공동주택 실거래가격지수', rows)],
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
