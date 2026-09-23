'use client'

import dynamic from 'next/dynamic'
import { useMarketPriceIndex } from '@/hooks/useMarketPriceIndex'
import { useMarketRealTransaction } from '@/hooks/useMarketRealTransaction'
import type { IndexChartSeries } from './IndexChart'
import type { MarketSeries, Region } from '@/lib/types'

// recharts를 초기 번들에서 뺀다(MarketStrip과 같은 이유) — 상세 페이지 하단이고 지역이
// 미매핑이면 아예 안 그려진다.
const IndexChart = dynamic(() => import('./IndexChart').then((m) => m.IndexChart), { ssr: false })

const MONTHS = 36

// 3라인이 겹치는 §7 단색 원칙의 유일한 예외다 — 색은 서로 다르게, 그리고 색각 이상 사용자를
// 위해 실선·점선·점 패턴도 같이 써서 색만으로 구분되지 않게 한다.
const SERIES_STYLE: Record<MarketSeries['key'], Pick<IndexChartSeries, 'color' | 'dashArray'>> = {
  sale: { color: 'var(--color-line)' },
  jeonse: { color: 'var(--color-series-jeonse)', dashArray: '6 3' },
  realTransaction: { color: 'var(--color-series-real)', dashArray: '2 2' },
}

// 통계 키가 없거나 지역이 미매핑이면 이 섹션만 사라진다(§5/§9). 실거래는 통계표 코드가
// 미확정이라(§4.5③) 항상 빠질 수 있는데, 그때도 매매·전세 2라인은 그대로 나와야 한다 —
// 하나의 쿼리 실패가 섹션 전체를 지우면 안 된다.
export function RegionMarket({ region }: { region: Region | null }) {
  const priceIndexQuery = useMarketPriceIndex(region, MONTHS)
  const realTransactionQuery = useMarketRealTransaction(region, MONTHS)

  if (region === null) return null
  // 로딩 중엔 스켈레톤을 둬서 섹션이 나중에 끼어들며 레이아웃이 점프하지 않게 한다.
  if (priceIndexQuery.isLoading) {
    return (
      <section aria-label="지역 시세">
        <div className="h-[240px] animate-pulse rounded bg-canvas" />
      </section>
    )
  }
  if (priceIndexQuery.isError || !priceIndexQuery.data) return null

  const series = [...priceIndexQuery.data.series, ...(realTransactionQuery.data?.series ?? [])]
  const chartSeries: IndexChartSeries[] = series
    .filter((s) => s.points.length > 0)
    .map((s) => ({ key: s.key, label: s.label, points: s.points, ...SERIES_STYLE[s.key] }))

  if (chartSeries.length === 0) return null

  return (
    <section aria-label="지역 시세">
      <h2 className="mb-1 text-sm font-medium text-ink-muted">
        {region} 시세 흐름 <span className="text-ink-muted">(최근 {MONTHS}개월)</span>
      </h2>
      <p className="mb-3 text-xs text-ink-muted">분양가가 시세 흐름 대비 어느 수준인지 판단할 맥락입니다.</p>
      <IndexChart series={chartSeries} height={240} />
      <p className="mt-2 text-xs text-ink-muted">지수는 기준시점을 100으로 한 상대값입니다. 절대 가격이 아닙니다.</p>
    </section>
  )
}
