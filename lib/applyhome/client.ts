import { OdcloudKeyMissingError } from '@/lib/errors'
import { APPLYHOME_OPERATIONS } from '@/lib/config'
import { ADAPTERS } from '@/lib/applyhome/adapters'
import { dedupe } from '@/lib/cache'
import { formatCondDate } from './parse'
import type { NoticeType } from '@/lib/types'

export const APPLYHOME_DETAIL_BASE = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1'
export const APPLYHOME_CMPET_BASE = 'https://api.odcloud.kr/api/ApplyhomeInfoCmpetRtSvc/v1'

export function hasOdcloudKey(): boolean {
  return Boolean(process.env.ODCLOUD_SERVICE_KEY)
}

export function assertOdcloudKey(): string {
  const key = process.env.ODCLOUD_SERVICE_KEY
  if (!key) throw new OdcloudKeyMissingError()
  return key
}

interface OdcloudResponse<T> {
  page: number
  perPage: number
  totalCount: number
  currentCount: number
  matchCount: number
  data: T[]
}

interface FetchPageOptions {
  page: number
  perPage: number
  cond?: Record<string, string>
  revalidate: number
}

async function fetchOdcloudPage<T>(baseUrl: string, operation: string, options: FetchPageOptions): Promise<OdcloudResponse<T>> {
  const key = assertOdcloudKey()
  const url = new URL(`${baseUrl}/${operation}`)
  url.searchParams.set('page', String(options.page))
  url.searchParams.set('perPage', String(options.perPage))
  for (const [field, value] of Object.entries(options.cond ?? {})) {
    url.searchParams.set(`cond[${field}]`, value)
  }
  const requestUrl = url.toString()

  // 조회 유형(operation) + cond(조회 시작일 등)가 URL에 그대로 반영되므로 URL 자체를 dedupe 키로 쓴다(§6).
  return dedupe(requestUrl, async () => {
    const res = await fetch(requestUrl, {
      // `Infuser` 접두어가 없으면 odcloud가 헤더를 무시하고 -401(인증키 없음)을 낸다. API-FIELDS 참조.
      headers: { Authorization: `Infuser ${key}` },
      next: { revalidate: options.revalidate },
    })
    if (!res.ok) throw new Error(`odcloud upstream ${operation} ${res.status}`)
    return (await res.json()) as OdcloudResponse<T>
  })
}

interface FetchAllOptions {
  cond?: Record<string, string>
  revalidate: number
  perPage?: number
}

/**
 * `data.length < perPage`가 나올 때까지 페이지를 이어 받아 전체 행을 모은다.
 */
export async function fetchOdcloudAll<T>(baseUrl: string, operation: string, options: FetchAllOptions): Promise<T[]> {
  const perPage = options.perPage ?? 100
  const rows: T[] = []
  let page = 1
  while (true) {
    const res = await fetchOdcloudPage<T>(baseUrl, operation, { page, perPage, cond: options.cond, revalidate: options.revalidate })
    rows.push(...res.data)
    if (res.data.length < perPage || rows.length >= res.matchCount) break
    page += 1
  }
  return rows
}

export interface NoticeSourceResult {
  type: NoticeType
  ok: boolean
  data: unknown[]
  error?: string
}

/**
 * 5개 유형의 Detail 오퍼레이션을 `Promise.allSettled`로 팬아웃한다.
 * 개별 오퍼레이션이 실패해도 나머지 결과로 응답할 수 있게 한다.
 */
export async function fetchNoticeDetailsFanout(
  types: NoticeType[],
  noticeDateFrom: Date,
  revalidate: number,
): Promise<NoticeSourceResult[]> {
  const settled = await Promise.allSettled(
    types.map(async (type) => {
      const operation = APPLYHOME_OPERATIONS[type].detail
      const cond = { [`${ADAPTERS[type].condFields.noticeDate}::GTE`]: formatCondDate(type, noticeDateFrom) }
      return fetchOdcloudAll<unknown>(APPLYHOME_DETAIL_BASE, operation, { cond, revalidate })
    }),
  )

  return settled.map((result, i) => {
    const type = types[i]
    if (result.status === 'fulfilled') {
      return { type, ok: true, data: result.value }
    }
    const reason = result.reason
    return { type, ok: false, data: [], error: reason instanceof Error ? reason.message : String(reason) }
  })
}
