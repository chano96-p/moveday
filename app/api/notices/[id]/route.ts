import { z } from 'zod'
import { CACHE_TTL, NOTICE_TYPES } from '@/lib/config'
import { ADAPTERS } from '@/lib/applyhome/adapters'
import { APPLYHOME_DETAIL_BASE, assertOdcloudKey, fetchOdcloudAll } from '@/lib/applyhome/client'
import { computeDday } from '@/lib/dday'
import { toErrorResponse } from '@/lib/errors'

const QuerySchema = z.object({
  type: z.enum(NOTICE_TYPES),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ type: url.searchParams.get('type') ?? undefined })
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', issues: parsed.error.issues }, { status: 400 })
  }

  const adapter = ADAPTERS[parsed.data.type]

  try {
    assertOdcloudKey()

    // {id}는 PBLANC_NO다. Mdl 조회에 HOUSE_MANAGE_NO도 필요하므로 Detail을 먼저 조회한다.
    const detailRows = await fetchOdcloudAll<unknown>(APPLYHOME_DETAIL_BASE, adapter.detailOperation, {
      cond: { [`${adapter.condFields.noticeNo}::EQ`]: id },
      revalidate: CACHE_TTL.noticeDetail,
      perPage: 10,
    })

    if (detailRows.length === 0) {
      return Response.json({ error: 'NOTICE_NOT_FOUND' }, { status: 404 })
    }

    const detailRaw = detailRows[0]
    const notice = adapter.toNotice(detailRaw)

    const mdlRows = await fetchOdcloudAll<unknown>(APPLYHOME_DETAIL_BASE, adapter.mdlOperation, {
      cond: {
        [`${adapter.condFields.houseManageNo}::EQ`]: notice.houseManageNo,
        [`${adapter.condFields.noticeNo}::EQ`]: notice.id,
      },
      revalidate: CACHE_TTL.noticeDetail,
      perPage: 100,
    })

    const supply = adapter.toSupplyRows(mdlRows)
    const prices = supply.map((row) => row.price).filter((v): v is number => v !== null)
    const minPrice = prices.length ? Math.min(...prices) : null
    const maxPrice = prices.length ? Math.max(...prices) : null

    const now = new Date()
    const responseNotice = {
      ...notice,
      minPrice,
      maxPrice,
      ...computeDday(notice.receiptStart, notice.receiptEnd, now),
    }

    const regulation = {
      ...adapter.toRegulation(detailRaw),
      note: '전매제한·재당첨제한은 공고문에서 확인하세요.',
    }

    return Response.json({
      notice: responseNotice,
      supply,
      regulation,
      noticeUrl: notice.noticeUrl,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
