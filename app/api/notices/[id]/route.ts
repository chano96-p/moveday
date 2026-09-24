import { z } from 'zod'
import { CACHE_TTL, NOTICE_TYPES } from '@/lib/config'
import { assertOdcloudKey } from '@/lib/applyhome/client'
import { fetchNoticeDetail } from '@/lib/applyhome/detail'
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

  try {
    assertOdcloudKey()

    const detail = await fetchNoticeDetail(id, parsed.data.type, CACHE_TTL.noticeDetail)
    if (detail === null) {
      return Response.json({ error: 'NOTICE_NOT_FOUND' }, { status: 404 })
    }

    const { notice, supply, regulation, minPrice, maxPrice } = detail

    return Response.json({
      notice: {
        ...notice,
        minPrice,
        maxPrice,
        ...computeDday(notice.receiptStart, notice.receiptEnd, new Date()),
      },
      supply,
      regulation: {
        ...regulation,
        note: '전매제한·재당첨제한은 공고문에서 확인하세요.',
      },
      noticeUrl: notice.noticeUrl,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
