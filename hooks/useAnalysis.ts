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

async function fetchAnalysis(id: string, type: NoticeType): Promise<AnalysisResponse> {
  const res = await fetch(`/api/notices/${id}/analysis?type=${type}`)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
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
