'use client'

import { useQuery } from '@tanstack/react-query'
import { CACHE_TTL } from '@/lib/config'
import type { Notice, NoticeType, SupplyRow } from '@/lib/types'
import type { DdayInfo } from '@/lib/dday'

export interface NoticeDetailResponse {
  notice: Notice & DdayInfo
  supply: SupplyRow[]
  regulation: { available: boolean; flags: { key: string; label: string }[]; note: string }
  noticeUrl: string | null
}

async function fetchNoticeDetail(id: string, type: NoticeType): Promise<NoticeDetailResponse> {
  const res = await fetch(`/api/notices/${id}?type=${type}`)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  return res.json()
}

// 상세(지연 조회) 쿼리 — CACHE_TTL.noticeDetail(30분)과 맞춘다(§8). NoticeTable이 화면에 보이는 행만 호출한다.
const NOTICE_DETAIL_STALE_TIME = CACHE_TTL.noticeDetail * 1000

export function useNoticeDetail(id: string, type: NoticeType) {
  return useQuery({
    queryKey: ['notice-detail', id, type],
    queryFn: () => fetchNoticeDetail(id, type),
    staleTime: NOTICE_DETAIL_STALE_TIME,
    // gcTime 기본값(5분)이 staleTime(30분)보다 짧으면 stale이 되기도 전에 캐시가 수거돼
    // 30분 캐시가 무력해진다. staleTime 이상으로 맞춘다.
    gcTime: NOTICE_DETAIL_STALE_TIME,
    // 상세 1건 = 상류 2콜(Detail+Mdl). 기본 3회 재시도면 실패 시 페이지당 최대 10행 × 3 × 2 =
    // 60콜까지 증폭된다. 실패는 `—`로 끝내면 되므로 재시도하지 않는다.
    retry: false,
  })
}
