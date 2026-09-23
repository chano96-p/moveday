'use client'

import { useQuery } from '@tanstack/react-query'
import { CACHE_TTL } from '@/lib/config'
import type { NoticeListItem, NoticeType, Region } from '@/lib/types'
import type { DdayInfo } from '@/lib/dday'

export type NoticeRow = NoticeListItem & DdayInfo

export interface NoticesResponse {
  notices: NoticeRow[]
  summary: { open: number; closingThisWeek: number; new: number }
  sources: { type: NoticeType; ok: boolean; count?: number; error?: string }[]
  fetchedAt: string
}

export interface NoticesQueryParams {
  region?: Region[]
  type?: NoticeType
}

async function fetchNotices(params: NoticesQueryParams): Promise<NoticesResponse> {
  const search = new URLSearchParams()
  for (const region of params.region ?? []) search.append('region', region)
  if (params.type) search.set('type', params.type)

  const res = await fetch(`/api/notices?${search.toString()}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `HTTP_${res.status}`)
  }
  return res.json()
}

// 목록 쿼리 — CACHE_TTL.noticeList(10분)과 맞춰 자동 갱신(§6/§8).
const NOTICE_LIST_STALE_TIME = CACHE_TTL.noticeList * 1000

export function useNotices(params: NoticesQueryParams) {
  return useQuery({
    queryKey: ['notices', params],
    queryFn: () => fetchNotices(params),
    staleTime: NOTICE_LIST_STALE_TIME,
    refetchInterval: NOTICE_LIST_STALE_TIME,
    // ODCLOUD_KEY_MISSING 같은 503은 재시도해도 같은 결과라 기본 재시도(3회, 지수 백오프)를 끈다.
    retry: false,
  })
}
