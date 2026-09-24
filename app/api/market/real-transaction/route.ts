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

    const table = REBSTAT_TABLES.apartmentRealTransactionIndex
    if (table === null) throw new RebstatTableUnknownError()

    // 실거래는 매매·전세와 CLS_ID 체계가 다르다(Phase 8 실측) — 반드시 이 표(table) 기준으로
    // 조회해야 한다. clsIdFor(region)처럼 표를 안 주면 다른 표의 코드를 잘못 쓰게 된다.
    const clsId = clsIdFor(region, table)
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
