'use client'

import { skipToken, useQuery } from '@tanstack/react-query'
import { CACHE_TTL } from '@/lib/config'
import type { NoticeType } from '@/lib/types'
import type { CompetitionResult } from '@/lib/applyhome/competition'

async function fetchCompetition(id: string, type: NoticeType): Promise<CompetitionResult | null> {
  const res = await fetch(`/api/notices/${id}/competition?type=${type}`)
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  return res.json()
}

// CACHE_TTL.competition(30분)과 맞춘다(§5·§6) — noticeDetail과 같은 TTL이다.
const COMPETITION_STALE_TIME = CACHE_TTL.competition * 1000

export function useCompetition(id: string, type: NoticeType | null) {
  return useQuery({
    queryKey: ['competition', id, type],
    queryFn: type === null ? skipToken : () => fetchCompetition(id, type),
    staleTime: COMPETITION_STALE_TIME,
    gcTime: COMPETITION_STALE_TIME,
    retry: false,
  })
}
