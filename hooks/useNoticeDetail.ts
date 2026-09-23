'use client'

import { skipToken, useQuery } from '@tanstack/react-query'
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

// `type`이 `null`이면(상세 페이지가 `type` 쿼리 없이 열린 경우) `skipToken`이 쿼리를 비활성화한다.
// `enabled` 플래그를 따로 두지 않아도 되고, `type`이 `null`이 아닐 때만 `fetchNoticeDetail`을
// 부르는 게 타입으로 강제된다(`type as NoticeType` 단정이 필요 없다).
export function useNoticeDetail(id: string, type: NoticeType | null) {
  return useQuery({
    queryKey: ['notice-detail', id, type],
    queryFn: type === null ? skipToken : () => fetchNoticeDetail(id, type),
    staleTime: NOTICE_DETAIL_STALE_TIME,
    // gcTime 기본값(5분)이 staleTime(30분)보다 짧으면 stale이 되기도 전에 캐시가 수거돼
    // 30분 캐시가 무력해진다. staleTime 이상으로 맞춘다.
    gcTime: NOTICE_DETAIL_STALE_TIME,
    // 상세 1건 = 상류 2콜(Detail+Mdl). 기본 3회 재시도면 실패 시 페이지당 최대 10행 × 3 × 2 =
    // 60콜까지 증폭된다. 실패는 `—`로 끝내면 되므로 재시도하지 않는다.
    retry: false,
  })
}
