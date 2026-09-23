import { z } from 'zod'
import { CACHE_TTL, NOTICE_TYPES } from '@/lib/config'
import { ADAPTERS } from '@/lib/applyhome/adapters'
import { APPLYHOME_DETAIL_BASE, assertOdcloudKey, fetchOdcloudAll } from '@/lib/applyhome/client'
import { fetchCompetitionResult } from '@/lib/applyhome/competition'
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

    // 경쟁률·특별공급·당첨가점 조회에는 HOUSE_MANAGE_NO·HOUSE_SECD가 필요하므로 Detail을 먼저 조회한다.
    const detailRows = await fetchOdcloudAll<unknown>(APPLYHOME_DETAIL_BASE, adapter.detailOperation, {
      cond: { [`${adapter.condFields.noticeNo}::EQ`]: id },
      revalidate: CACHE_TTL.competition,
      perPage: 10,
    })

    if (detailRows.length === 0) {
      return Response.json({ error: 'NOTICE_NOT_FOUND' }, { status: 404 })
    }

    const notice = adapter.toNotice(detailRows[0])
    const result = await fetchCompetitionResult(notice, CACHE_TTL.competition)

    if (result === null) {
      return new Response(null, { status: 204 })
    }

    return Response.json(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
