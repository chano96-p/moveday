'use client'

import { skipToken, useQuery } from '@tanstack/react-query'
import { CACHE_TTL } from '@/lib/config'
import type { MarketSeries, Region } from '@/lib/types'

export interface PriceIndexResponse {
  region: string
  baseNote: string
  series: MarketSeries[]
}

async function fetchPriceIndex(region: Region | '전국', months: number): Promise<PriceIndexResponse> {
  const res = await fetch(`/api/market/price-index?region=${encodeURIComponent(region)}&months=${months}`)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  return res.json()
}

// CACHE_TTL.marketStats(24시간)와 맞춘다(§6) — 월 단위 공표라 자주 바뀌지 않는다.
const MARKET_STALE_TIME = CACHE_TTL.marketStats * 1000

export function useMarketPriceIndex(region: Region | '전국' | null, months: number) {
  return useQuery({
    queryKey: ['market-price-index', region, months],
    queryFn: region === null ? skipToken : () => fetchPriceIndex(region, months),
    staleTime: MARKET_STALE_TIME,
    gcTime: MARKET_STALE_TIME,
    retry: false,
  })
}
