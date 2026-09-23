'use client'

import { skipToken, useQuery } from '@tanstack/react-query'
import { CACHE_TTL } from '@/lib/config'
import type { MarketSeries, Region } from '@/lib/types'

export interface RealTransactionResponse {
  region: string
  baseNote: string
  series: MarketSeries[]
}

async function fetchRealTransaction(region: Region | '전국', months: number): Promise<RealTransactionResponse> {
  const res = await fetch(`/api/market/real-transaction?region=${encodeURIComponent(region)}&months=${months}`)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  return res.json()
}

const MARKET_STALE_TIME = CACHE_TTL.marketStats * 1000

// 통계표 코드가 미확정이라 이 쿼리는 지금 항상 503(REBSTAT_TABLE_UNKNOWN)이다 — 정상 동작이다.
// RegionMarket이 isError를 조용히 무시하고 매매·전세만 그리는 이유가 이것이다(§4.5③).
export function useMarketRealTransaction(region: Region | '전국' | null, months: number) {
  return useQuery({
    queryKey: ['market-real-transaction', region, months],
    queryFn: region === null ? skipToken : () => fetchRealTransaction(region, months),
    staleTime: MARKET_STALE_TIME,
    gcTime: MARKET_STALE_TIME,
    retry: false,
  })
}
