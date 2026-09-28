'use client'

import { skipToken, useQuery } from '@tanstack/react-query'
import { CACHE_TTL } from '@/lib/config'
import type { NoticeAnalysis } from '@/lib/analysis/schema'
import type { NoticeType } from '@/lib/types'

export interface AnalysisResponse {
  analysis: NoticeAnalysis
  model: string
  generatedAt: string
  inputs: { competition: boolean; market: boolean }
}

/**
 * 실패는 **상태코드가 아니라 본문의 `error` 코드**로 구분한다. 화면이 구분해야 하는
 * 네 가지(키 없음 / 분당 한도 / 모델 과부하 / 그 외) 중 뒤의 둘이 같은 502라서,
 * 상태코드만 보면 "잠시 후 다시"와 "설정이 잘못됨"을 갈라 말할 수 없다.
 */
async function fetchAnalysis(id: string, type: NoticeType): Promise<AnalysisResponse> {
  const res = await fetch(`/api/notices/${id}/analysis?type=${type}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error((body as { error?: string } | null)?.error ?? `HTTP_${res.status}`)
  }
  return res.json()
}

const ANALYSIS_STALE_TIME = CACHE_TTL.analysis * 1000

/**
 * 다른 훅과 달리 **`enabled: false`** 다. 상세를 열기만 해도 도는 구조로 두면 크롤러가
 * 목록을 훑는 것만으로 Gemini 무료 티어 한도가 날아간다 — 버튼에서 `refetch()`로만 시작한다.
 */
export function useAnalysis(id: string, type: NoticeType | null) {
  return useQuery({
    queryKey: ['analysis', id, type],
    queryFn: type === null ? skipToken : () => fetchAnalysis(id, type),
    enabled: false,
    staleTime: ANALYSIS_STALE_TIME,
    gcTime: ANALYSIS_STALE_TIME,
    retry: false,
  })
}
