import { z } from 'zod'
import { subMonths, differenceInCalendarDays, parseISO } from 'date-fns'
import { CACHE_TTL, NOTICE_TYPES, REGIONS } from '@/lib/config'
import { ADAPTERS } from '@/lib/applyhome/adapters'
import { assertOdcloudKey, fetchNoticeDetailsFanout } from '@/lib/applyhome/client'
import { computeDday, todayInSeoul, type DdayInfo } from '@/lib/dday'
import { toErrorResponse } from '@/lib/errors'
import type { Notice, NoticeListItem, NoticeType } from '@/lib/types'

const QuerySchema = z.object({
  region: z.array(z.enum(REGIONS)).optional(),
  type: z.enum(NOTICE_TYPES).optional(),
  status: z.enum(['open', 'upcoming', 'closed']).optional(),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const regionParams = url.searchParams.getAll('region')

  const parsed = QuerySchema.safeParse({
    region: regionParams.length ? regionParams : undefined,
    type: url.searchParams.get('type') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  })

  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', issues: parsed.error.issues }, { status: 400 })
  }
  const query = parsed.data

  try {
    assertOdcloudKey()

    const types: NoticeType[] = query.type ? [query.type] : [...NOTICE_TYPES]
    const noticeDateFrom = subMonths(new Date(), 3)
    const results = await fetchNoticeDetailsFanout(types, noticeDateFrom, CACHE_TTL.noticeList)

    const now = new Date()
    const today = todayInSeoul(now)
    const sources = results.map((r) =>
      r.ok ? { type: r.type, ok: true, count: r.data.length } : { type: r.type, ok: false, error: r.error },
    )

    let notices: Notice[] = results
      .filter((r) => r.ok)
      .flatMap((r) => r.data.map((raw) => ADAPTERS[r.type].toNotice(raw)))

    if (query.region?.length) {
      const regionSet = new Set(query.region)
      notices = notices.filter((n) => n.region !== null && regionSet.has(n.region))
    }

    const summary = {
      open: notices.filter((n) => computeDday(n.receiptStart, n.receiptEnd, now).status === 'open').length,
      closingThisWeek: notices.filter((n) => {
        if (!n.receiptEnd) return false
        const diff = differenceInCalendarDays(parseISO(n.receiptEnd), today)
        return diff >= 0 && diff <= 6
      }).length,
      new: notices.filter((n) => {
        if (!n.noticeDate) return false
        const diff = differenceInCalendarDays(today, parseISO(n.noticeDate))
        return diff >= 0 && diff <= 6
      }).length,
    }

    let withDday: (NoticeListItem & DdayInfo)[] = notices.map((n) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- minPrice/maxPrice는 목록 응답에서 의도적으로 제외한다(§4.1/§8)
      const { minPrice, maxPrice, ...listItem } = n
      return { ...listItem, ...computeDday(n.receiptStart, n.receiptEnd, now) }
    })

    if (query.status) {
      withDday = withDday.filter((n) => n.status === query.status)
    }

    return Response.json({
      notices: withDday,
      summary,
      sources,
      fetchedAt: now.toISOString(),
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
